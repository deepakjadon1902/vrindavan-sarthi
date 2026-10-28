import { Html5Qrcode } from 'html5-qrcode';

export interface CameraDevice {
  id: string;
  label: string;
  isBackCamera: boolean;
}

export type CameraErrorCode =
  | 'INSECURE_CONTEXT'
  | 'UNSUPPORTED_BROWSER'
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'CAMERA_IN_USE'
  | 'OVERCONSTRAINED'
  | 'SECURITY_ERROR'
  | 'VIEWFINDER_NOT_MOUNTED'
  | 'INIT_FAILED';

export interface CameraDiagnostic {
  supported: boolean;
  code?: CameraErrorCode;
  message?: string;
  guidance?: string;
}

/**
 * Checks whether the current browser and network context can support camera access.
 */
export function checkCameraEnvironment(): CameraDiagnostic {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      code: 'UNSUPPORTED_BROWSER',
      message: 'Camera scanning is only available in a web browser.',
    };
  }

  // Camera requires HTTPS unless running locally
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]';

  const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocalhost;

  if (!isSecure) {
    return {
      supported: false,
      code: 'INSECURE_CONTEXT',
      message: 'Camera access requires a secure HTTPS connection.',
      guidance: 'Browsers block camera access over plain HTTP. Please ensure you are accessing the application via https://.',
    };
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    return {
      supported: false,
      code: 'UNSUPPORTED_BROWSER',
      message: 'Your browser or device does not support camera streaming.',
      guidance: 'Please update your browser (Chrome, Safari, Edge, Firefox) or use the manual booking reference lookup below.',
    };
  }

  return { supported: true };
}

/**
 * Explicitly triggers browser camera permission dialog and returns enumerated cameras.
 * The probe stream is immediately stopped to prevent camera lock.
 */
export async function requestCameraPermissionAndEnumerate(
  preferredFacing: 'environment' | 'user' = 'environment'
): Promise<{
  granted: boolean;
  cameras: CameraDevice[];
  preferredCameraId?: string;
  error?: { code: CameraErrorCode; message: string; guidance?: string };
}> {
  const envCheck = checkCameraEnvironment();
  if (!envCheck.supported) {
    return {
      granted: false,
      cameras: [],
      error: {
        code: envCheck.code || 'UNSUPPORTED_BROWSER',
        message: envCheck.message || 'Camera not supported',
        guidance: envCheck.guidance,
      },
    };
  }

  let probeStream: MediaStream | null = null;
  try {
    // 1. Explicitly prompt user for permission via getUserMedia
    try {
      probeStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: preferredFacing } },
      });
    } catch (facingErr: any) {
      // If ideal facingMode constraint fails, fallback to basic video request
      if (facingErr.name === 'OverconstrainedError' || facingErr.name === 'ConstraintNotSatisfiedError') {
        probeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      } else {
        throw facingErr;
      }
    }

    // Stop probe tracks immediately so the hardware is freed for the scanner
    if (probeStream) {
      probeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }

    // 2. Enumerate available video inputs now that permission has been granted
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');

    if (!videoDevices.length) {
      return {
        granted: true,
        cameras: [],
        error: {
          code: 'NO_CAMERA',
          message: 'No video camera detected on this device.',
          guidance: 'Please ensure your camera is connected and enabled, or use manual booking search.',
        },
      };
    }

    const cameras: CameraDevice[] = videoDevices.map((dev, idx) => {
      const label = dev.label || `Camera ${idx + 1}`;
      const lower = label.toLowerCase();
      const isBackCamera =
        lower.includes('back') ||
        lower.includes('rear') ||
        lower.includes('environment') ||
        lower.includes('facing back');

      return {
        id: dev.deviceId,
        label,
        isBackCamera,
      };
    });

    // Determine preferred camera: pick back camera if available, otherwise first camera
    const backCam = cameras.find((c) => c.isBackCamera);
    const preferredCameraId = backCam ? backCam.id : cameras[0].id;

    return {
      granted: true,
      cameras,
      preferredCameraId,
    };
  } catch (err: any) {
    // Clean up probe stream if left open
    if (probeStream) {
      probeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }

    const errName = String(err?.name || '');
    const errMsg = String(err?.message || err || '');

    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.includes('Permission')) {
      return {
        granted: false,
        cameras: [],
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Camera permission was denied in your browser.',
          guidance: 'Please tap the camera/lock icon in your address bar, set Camera to "Allow", and click Start Scanner again.',
        },
      };
    }

    if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || errMsg.includes('no camera')) {
      return {
        granted: false,
        cameras: [],
        error: {
          code: 'NO_CAMERA',
          message: 'No camera hardware found on this device.',
          guidance: 'Please connect a webcam or use the manual reference search below.',
        },
      };
    }

    if (errName === 'NotReadableError' || errName === 'TrackStartError' || errMsg.includes('in use')) {
      return {
        granted: false,
        cameras: [],
        error: {
          code: 'CAMERA_IN_USE',
          message: 'Camera is currently in use or unavailable.',
          guidance: 'Another app or browser tab may be using your camera. Please close other camera apps and try again.',
        },
      };
    }

    if (errName === 'SecurityError') {
      return {
        granted: false,
        cameras: [],
        error: {
          code: 'SECURITY_ERROR',
          message: 'Camera access blocked by security or permissions policy.',
          guidance: 'Check browser privacy/security settings or iframe permissions.',
        },
      };
    }

    return {
      granted: false,
      cameras: [],
      error: {
        code: 'INIT_FAILED',
        message: 'Could not initialize camera scanner: ' + (errMsg || errName || 'Unknown error'),
        guidance: 'Please refresh the page, check device permissions, or use manual reference lookup.',
      },
    };
  }
}

/**
 * Extracts booking reference or display ID from raw scanned text or URL
 */
export function extractBookingReference(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  // 1. Scanned query param URL (e.g. https://domain/verify-booking?ref=VS-12345 or ?id=10000001)
  if (raw.includes('?')) {
    try {
      const queryPart = raw.split('?')[1];
      const params = new URLSearchParams(queryPart);
      const val = params.get('ref') || params.get('id') || params.get('bookingId');
      if (val) return String(val).trim();
    } catch {}
  }

  // 2. Scanned path URL (e.g. https://domain/verify-booking/10000001 or /bookings/verify/...)
  if (raw.includes('/verify-booking/')) {
    const after = raw.split('/verify-booking/')[1];
    if (after) {
      return String(after.split('?')[0].split('/')[0]).trim();
    }
  }

  if (raw.includes('/verify/')) {
    const after = raw.split('/verify/')[1];
    if (after) {
      return String(after.split('?')[0].split('/')[0]).trim();
    }
  }

  // 3. Raw booking reference / numeric ID
  return raw;
}

/**
 * Helper to safely stop and clear an Html5Qrcode instance
 */
export async function stopAndClearScanner(scanner: Html5Qrcode | null): Promise<void> {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
    scanner.clear();
  } catch (err) {
    console.warn('[QRCameraManager] Error stopping scanner:', err);
  }
}
