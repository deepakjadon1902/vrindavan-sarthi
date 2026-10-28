import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  AlertCircle,
  Loader2,
  RefreshCw,
  SwitchCamera,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  CameraDevice,
  CameraErrorCode,
  checkCameraEnvironment,
  requestCameraPermissionAndEnumerate,
  stopAndClearScanner,
} from '@/lib/qrCameraManager';

export interface CameraQRScannerProps {
  onScanSuccess: (decodedText: string) => void | Promise<void>;
  elementId?: string;
  autoStartPrompt?: boolean;
  buttonLabel?: string;
  className?: string;
}

export const CameraQRScanner: React.FC<CameraQRScannerProps> = ({
  onScanSuccess,
  elementId = 'vs-qr-scanner-viewfinder',
  buttonLabel = 'Open Camera Scanner',
  className = '',
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorGuidance, setErrorGuidance] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<CameraErrorCode | null>(null);
  const [detectionTipVisible, setDetectionTipVisible] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const tipTimerRef = useRef<any>(null);

  // Stop camera helper
  const handleStop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    setDetectionTipVisible(false);

    try {
      await stopAndClearScanner(scannerRef.current);
    } finally {
      scannerRef.current = null;
      isStoppingRef.current = false;
      if (isMountedRef.current) {
        setIsScanning(false);
        setIsStarting(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      if (scannerRef.current) {
        stopAndClearScanner(scannerRef.current).catch(console.warn);
      }
    };
  }, []);

  // Start camera scanning with permission prompt
  const handleStart = useCallback(
    async (overrideCameraId?: string) => {
      if (isStarting || isScanning) return;
      setErrorMessage(null);
      setErrorGuidance(null);
      setErrorCode(null);
      setDetectionTipVisible(false);
      setIsStarting(true);

      // 1. Initial environment diagnostic
      const envCheck = checkCameraEnvironment();
      if (!envCheck.supported) {
        setIsStarting(false);
        setErrorCode(envCheck.code || 'UNSUPPORTED_BROWSER');
        setErrorMessage(envCheck.message || 'Camera scanning not supported');
        setErrorGuidance(envCheck.guidance || null);
        return;
      }

      // Stop any existing instance
      await handleStop();

      // 2. Request camera permission via browser prompt & enumerate video inputs
      const permResult = await requestCameraPermissionAndEnumerate('environment');
      if (!permResult.granted || permResult.error) {
        setIsStarting(false);
        setErrorCode(permResult.error?.code || 'PERMISSION_DENIED');
        setErrorMessage(permResult.error?.message || 'Camera permission was not granted.');
        setErrorGuidance(permResult.error?.guidance || null);
        return;
      }

      setCameras(permResult.cameras);
      const targetCamId = overrideCameraId || selectedCameraId || permResult.preferredCameraId || (permResult.cameras[0] && permResult.cameras[0].id);
      setSelectedCameraId(targetCamId || null);

      // 3. Mark scanning as active so React mounts and displays the viewfinder DOM element
      setIsScanning(true);

      // Allow one animation frame/tick for the DOM element to become visible with non-zero dimensions
      await new Promise((r) => setTimeout(r, 60));
      if (!isMountedRef.current || typeof document === 'undefined') return;

      const container = document.getElementById(elementId);
      if (!container) {
        setIsStarting(false);
        setIsScanning(false);
        setErrorCode('VIEWFINDER_NOT_MOUNTED');
        setErrorMessage('Viewfinder element failed to mount.');
        return;
      }

      try {
        const html5Qr = new Html5Qrcode(elementId);
        scannerRef.current = html5Qr;

        const config = {
          fps: 10,
          aspectRatio: 1.0,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: edge, height: edge };
          },
        };

        const cameraChoice = targetCamId
          ? targetCamId
          : { facingMode: 'environment' };

        await html5Qr.start(
          cameraChoice,
          config,
          async (decodedText: string) => {
            // Guard against duplicate scan processing
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

            // Stop camera immediately once valid code is read
            await handleStop();

            try {
              await onScanSuccess(decodedText);
            } finally {
              isProcessingRef.current = false;
            }
          },
          () => {
            // Frame error is normal while searching for QR
          }
        );

        setIsStarting(false);

        // Start 6-second detection tip timer
        tipTimerRef.current = setTimeout(() => {
          setDetectionTipVisible(true);
        }, 6000);
      } catch (err: any) {
        console.error('[CameraQRScanner] Failed to start viewfinder:', err);
        await handleStop();
        setIsStarting(false);
        setIsScanning(false);
        const rawMsg = String(err?.message || err || '');

        if (rawMsg.includes('NotAllowedError') || rawMsg.includes('Permission')) {
          setErrorCode('PERMISSION_DENIED');
          setErrorMessage('Camera permission was denied in your browser.');
          setErrorGuidance('Please allow camera access in browser site settings.');
        } else if (rawMsg.includes('NotFoundError') || rawMsg.includes('no camera')) {
          setErrorCode('NO_CAMERA');
          setErrorMessage('No camera found on this device.');
          setErrorGuidance('Please use the manual reference search below.');
        } else if (rawMsg.includes('in use') || rawMsg.includes('NotReadableError')) {
          setErrorCode('CAMERA_IN_USE');
          setErrorMessage('Camera is currently in use by another application.');
          setErrorGuidance('Close other apps using the camera and try again.');
        } else {
          setErrorCode('INIT_FAILED');
          setErrorMessage('Could not initialize camera preview: ' + rawMsg);
          setErrorGuidance('Please refresh or enter the booking reference manually.');
        }
      }
    },
    [elementId, handleStop, isScanning, isStarting, onScanSuccess, selectedCameraId]
  );

  // Switch camera if multiple cameras are available
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIdx = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIdx = (currentIdx + 1) % cameras.length;
    const nextCam = cameras[nextIdx];
    setSelectedCameraId(nextCam.id);
    await handleStop();
    await handleStart(nextCam.id);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Action Bar: Start / Stop / Switch Camera */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-700" />
          Camera Scanner
        </span>

        <div className="flex items-center gap-2">
          {cameras.length > 1 && isScanning && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
              title="Switch between front and back cameras"
            >
              <SwitchCamera className="w-3.5 h-3.5" /> Switch Camera
            </button>
          )}

          {isScanning ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
            >
              <CameraOff className="w-3.5 h-3.5" /> Stop Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStart()}
              disabled={isStarting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Requesting Camera...
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" /> {buttonLabel}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live Viewfinder Element */}
      <div
        className={`relative w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 transition-all ${
          isScanning
            ? 'border-emerald-600 bg-black min-h-[300px]'
            : 'hidden'
        }`}
      >
        <div id={elementId} className="w-full h-full" />

        {isScanning && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[11px] text-white pointer-events-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Scanner Active
            </span>
            <span className="text-gray-300">
              {cameras.find((c) => c.id === selectedCameraId)?.isBackCamera ? 'Rear Camera' : 'Camera'}
            </span>
          </div>
        )}
      </div>

      {/* Real-time Instructions and Hints */}
      {isScanning && (
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-600 font-medium animate-pulse">
            Align the voucher QR code inside the green viewfinder box.
          </p>
          {detectionTipVisible && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[11px] text-amber-800 animate-in fade-in">
              <Info className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Hold code steady and ensure good lighting for fast detection.</span>
            </div>
          )}
        </div>
      )}

      {/* Actionable Error Guidance Card */}
      {errorMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900 text-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            {errorCode === 'INSECURE_CONTEXT' || errorCode === 'SECURITY_ERROR' ? (
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold text-amber-950">
                {errorCode === 'PERMISSION_DENIED'
                  ? 'Camera Permission Required'
                  : errorCode === 'INSECURE_CONTEXT'
                  ? 'Secure HTTPS Connection Required'
                  : errorCode === 'NO_CAMERA'
                  ? 'No Camera Found'
                  : errorCode === 'CAMERA_IN_USE'
                  ? 'Camera Busy'
                  : 'Camera Scanner Notice'}
              </p>
              <p className="mt-0.5 text-amber-800">{errorMessage}</p>
              {errorGuidance && <p className="mt-1 font-semibold text-amber-900">{errorGuidance}</p>}
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleStart()}
              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Try Again
            </button>
            <span className="text-[11px] text-amber-700">Or use the manual reference search below.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraQRScanner;
