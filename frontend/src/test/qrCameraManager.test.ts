import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkCameraEnvironment,
  requestCameraPermissionAndEnumerate,
  extractBookingReference,
  stopAndClearScanner,
} from '@/lib/qrCameraManager';

describe('qrCameraManager', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    });
  });

  describe('extractBookingReference', () => {
    it('extracts reference from query string ref parameter', () => {
      const url = 'https://www.vrindavansarthi.in/verify-booking?ref=VS-261024-DH8201';
      expect(extractBookingReference(url)).toBe('VS-261024-DH8201');
    });

    it('extracts reference from query string id parameter', () => {
      const url = 'https://www.vrindavansarthi.in/verify-booking?id=10000001';
      expect(extractBookingReference(url)).toBe('10000001');
    });

    it('extracts reference from query string bookingId parameter', () => {
      const url = 'https://www.vrindavansarthi.in/verify-booking?bookingId=67123456789abcdef0123456';
      expect(extractBookingReference(url)).toBe('67123456789abcdef0123456');
    });

    it('extracts reference from path parameter /verify-booking/REF', () => {
      const url = 'https://www.vrindavansarthi.in/verify-booking/10000001?utm_source=print';
      expect(extractBookingReference(url)).toBe('10000001');
    });

    it('extracts reference from path parameter /verify/REF', () => {
      const url = 'https://www.vrindavansarthi.in/api/bookings/verify/VS-998877';
      expect(extractBookingReference(url)).toBe('VS-998877');
    });

    it('returns trimmed raw reference if plain string', () => {
      expect(extractBookingReference('  VSB-12345  ')).toBe('VSB-12345');
      expect(extractBookingReference('10000005')).toBe('10000005');
      expect(extractBookingReference('')).toBe('');
    });
  });

  describe('checkCameraEnvironment', () => {
    it('returns supported: true in a secure environment with mediaDevices', () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn(), enumerateDevices: vi.fn() },
        writable: true,
        configurable: true,
      });

      const res = checkCameraEnvironment();
      expect(res.supported).toBe(true);
      expect(res.code).toBeUndefined();
    });

    it('detects insecure context when isSecureContext is false on non-localhost', () => {
      Object.defineProperty(window, 'isSecureContext', { value: false, writable: true, configurable: true });
      // JSDOM hostname defaults to localhost; mock location hostname to public domain
      delete (window as any).location;
      (window as any).location = { hostname: 'example.com', protocol: 'http:' };

      const res = checkCameraEnvironment();
      expect(res.supported).toBe(false);
      expect(res.code).toBe('INSECURE_CONTEXT');
      expect(res.message).toContain('secure HTTPS connection');
    });

    it('detects unsupported browser when mediaDevices.getUserMedia is missing', () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });

      const res = checkCameraEnvironment();
      expect(res.supported).toBe(false);
      expect(res.code).toBe('UNSUPPORTED_BROWSER');
    });
  });

  describe('requestCameraPermissionAndEnumerate', () => {
    it('requests getUserMedia and correctly identifies back/environment camera', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });

      const mockTrackStop = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: mockTrackStop }],
      };

      const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
      const enumerateDevicesMock = vi.fn().mockResolvedValue([
        { deviceId: 'cam-front', kind: 'videoinput', label: 'Front FaceTime Camera' },
        { deviceId: 'cam-back', kind: 'videoinput', label: 'Back Camera 0 (facing back)' },
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Mic' },
      ]);

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: getUserMediaMock,
          enumerateDevices: enumerateDevicesMock,
        },
        writable: true,
        configurable: true,
      });

      const result = await requestCameraPermissionAndEnumerate('environment');

      expect(result.granted).toBe(true);
      expect(getUserMediaMock).toHaveBeenCalledWith({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      // Probe stream should be closed immediately to avoid locking the camera
      expect(mockTrackStop).toHaveBeenCalled();
      expect(result.cameras.length).toBe(2);
      expect(result.cameras[1].isBackCamera).toBe(true);
      expect(result.preferredCameraId).toBe('cam-back');
    });

    it('handles NotAllowedError with actionable permission guidance', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });

      const permError = new Error('Permission denied');
      permError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(permError),
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
        writable: true,
        configurable: true,
      });

      const result = await requestCameraPermissionAndEnumerate();

      expect(result.granted).toBe(false);
      expect(result.error?.code).toBe('PERMISSION_DENIED');
      expect(result.error?.message).toContain('Camera permission was denied');
      expect(result.error?.guidance).toContain('Allow');
    });

    it('handles NotFoundError when no camera is present', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });

      const notFoundError = new Error('Requested device not found');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(notFoundError),
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
        writable: true,
        configurable: true,
      });

      const result = await requestCameraPermissionAndEnumerate();

      expect(result.granted).toBe(false);
      expect(result.error?.code).toBe('NO_CAMERA');
      expect(result.error?.message).toContain('No camera hardware found');
    });

    it('handles NotReadableError when camera is locked by another app', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });

      const inUseError = new Error('Could not start video source');
      inUseError.name = 'NotReadableError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(inUseError),
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
        writable: true,
        configurable: true,
      });

      const result = await requestCameraPermissionAndEnumerate();

      expect(result.granted).toBe(false);
      expect(result.error?.code).toBe('CAMERA_IN_USE');
      expect(result.error?.message).toContain('Camera is currently in use');
    });

    it('falls back to { video: true } when facingMode OverconstrainedError occurs', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });

      const overconstrained = new Error('Constraint not satisfied');
      overconstrained.name = 'OverconstrainedError';

      const mockTrackStop = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: mockTrackStop }],
      };

      const getUserMediaMock = vi
        .fn()
        .mockRejectedValueOnce(overconstrained)
        .mockResolvedValueOnce(mockStream);

      const enumerateDevicesMock = vi.fn().mockResolvedValue([
        { deviceId: 'cam-front-only', kind: 'videoinput', label: 'Laptop Webcam' },
      ]);

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: getUserMediaMock,
          enumerateDevices: enumerateDevicesMock,
        },
        writable: true,
        configurable: true,
      });

      const result = await requestCameraPermissionAndEnumerate('environment');

      expect(result.granted).toBe(true);
      expect(getUserMediaMock).toHaveBeenCalledTimes(2);
      expect(getUserMediaMock).toHaveBeenNthCalledWith(2, {
        audio: false,
        video: true,
      });
      expect(result.cameras.length).toBe(1);
      expect(result.preferredCameraId).toBe('cam-front-only');
    });
  });

  describe('stopAndClearScanner', () => {
    it('stops and clears scanner when scanning is active', async () => {
      const mockStop = vi.fn().mockResolvedValue(undefined);
      const mockClear = vi.fn();
      const mockScanner: any = {
        isScanning: true,
        stop: mockStop,
        clear: mockClear,
      };

      await stopAndClearScanner(mockScanner);
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });

    it('safely handles null scanner or non-scanning state', async () => {
      await expect(stopAndClearScanner(null)).resolves.not.toThrow();

      const mockScanner: any = {
        isScanning: false,
        stop: vi.fn(),
        clear: vi.fn(),
      };
      await stopAndClearScanner(mockScanner);
      expect(mockScanner.stop).not.toHaveBeenCalled();
      expect(mockScanner.clear).toHaveBeenCalled();
    });
  });
});
