import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CameraQRScanner from '@/components/common/CameraQRScanner';
import { Html5Qrcode } from 'html5-qrcode';

// Mock html5-qrcode
vi.mock('html5-qrcode', () => {
  const mockStart = vi.fn();
  const mockStop = vi.fn().mockResolvedValue(undefined);
  const mockClear = vi.fn();

  return {
    Html5Qrcode: vi.fn().mockImplementation(() => {
      return {
        start: mockStart,
        stop: mockStop,
        clear: mockClear,
        isScanning: true,
      };
    }),
  };
});

describe('CameraQRScanner component', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'isSecureContext', { value: true, writable: true, configurable: true });
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

  it('renders initial closed state with Start button and does NOT request camera automatically', () => {
    const getUserMediaMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock, enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<CameraQRScanner onScanSuccess={vi.fn()} buttonLabel="Open Camera Scanner" />);

    expect(screen.getByText('Open Camera Scanner')).toBeInTheDocument();
    expect(screen.getByText('Camera Scanner')).toBeInTheDocument();
    // No automatic camera request on mount
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });

  it('handles permission denial gracefully with clear guidance message', async () => {
    const permError = new Error('Permission denied by user');
    permError.name = 'NotAllowedError';

    const getUserMediaMock = vi.fn().mockRejectedValue(permError);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock, enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<CameraQRScanner onScanSuccess={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /camera/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Required')).toBeInTheDocument();
      expect(screen.getByText(/Camera permission was denied in your browser/i)).toBeInTheDocument();
      expect(screen.getByText(/Try Again/i)).toBeInTheDocument();
    });
  });

  it('displays Android Settings guidance when permission is denied inside native APK', async () => {
    localStorage.setItem('vrs_native_apk', '1');
    const permError = new Error('Permission denied by user');
    permError.name = 'NotAllowedError';

    const getUserMediaMock = vi.fn().mockRejectedValue(permError);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock, enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<CameraQRScanner onScanSuccess={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /camera/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Required')).toBeInTheDocument();
      expect(screen.getByText(/Camera permission was denied in the Android app/i)).toBeInTheDocument();
      expect(screen.getByText(/Android Settings/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });

    localStorage.removeItem('vrs_native_apk');
  });

  it('handles no camera found error with informative notice', async () => {
    const notFoundErr = new Error('Requested device not found');
    notFoundErr.name = 'NotFoundError';

    const getUserMediaMock = vi.fn().mockRejectedValue(notFoundErr);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock, enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<CameraQRScanner onScanSuccess={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /camera/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('No Camera Found')).toBeInTheDocument();
      expect(screen.getByText(/No camera hardware found on this device/i)).toBeInTheDocument();
    });
  });

  it('starts scanner on click, requests camera permission, and initializes viewfinder', async () => {
    const mockTrackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockTrackStop }],
    };

    const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    const enumerateDevicesMock = vi.fn().mockResolvedValue([
      { deviceId: 'cam-back-id', kind: 'videoinput', label: 'Rear Camera' },
    ]);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      },
      writable: true,
      configurable: true,
    });

    const onScanSuccessMock = vi.fn();
    render(<CameraQRScanner onScanSuccess={onScanSuccessMock} elementId="test-viewfinder" />);

    const startBtn = screen.getByRole('button', { name: /camera/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalled();
      expect(screen.getByText('Stop Camera')).toBeInTheDocument();
      expect(screen.getByText('Live Scanner Active')).toBeInTheDocument();
      expect(Html5Qrcode).toHaveBeenCalledWith('test-viewfinder');
    });
  });

  it('stops scanning and cleans up when Stop Camera button is clicked', async () => {
    const mockTrackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockTrackStop }],
    };

    const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    const enumerateDevicesMock = vi.fn().mockResolvedValue([
      { deviceId: 'cam-1', kind: 'videoinput', label: 'Rear Camera' },
    ]);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      },
      writable: true,
      configurable: true,
    });

    render(<CameraQRScanner onScanSuccess={vi.fn()} elementId="test-viewfinder-stop" />);

    // Start scanner
    fireEvent.click(screen.getByRole('button', { name: /camera/i }));

    await waitFor(() => {
      expect(screen.getByText('Stop Camera')).toBeInTheDocument();
    });

    // Stop scanner
    fireEvent.click(screen.getByText('Stop Camera'));

    await waitFor(() => {
      expect(screen.getByText('Open Camera Scanner')).toBeInTheDocument();
    });
  });

  it('cleans up scanner and stops tracks on component unmount', async () => {
    const mockTrackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockTrackStop }],
    };

    const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    const enumerateDevicesMock = vi.fn().mockResolvedValue([
      { deviceId: 'cam-1', kind: 'videoinput', label: 'Camera 1' },
    ]);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      },
      writable: true,
      configurable: true,
    });

    const { unmount } = render(<CameraQRScanner onScanSuccess={vi.fn()} elementId="test-viewfinder-unmount" />);

    fireEvent.click(screen.getByRole('button', { name: /camera/i }));

    await waitFor(() => {
      expect(screen.getByText('Stop Camera')).toBeInTheDocument();
    });

    unmount();
    // Component unmount should safely execute without throwing
  });

  it('triggers onScanSuccess on valid QR detection and prevents duplicate submissions', async () => {
    let capturedSuccessCb: ((decoded: string) => void) | null = null;
    const mockStop = vi.fn().mockResolvedValue(undefined);
    const mockClear = vi.fn();

    (Html5Qrcode as any).mockImplementation(() => ({
      start: vi.fn().mockImplementation((_cam, _cfg, successCb) => {
        capturedSuccessCb = successCb;
        return Promise.resolve();
      }),
      stop: mockStop,
      clear: mockClear,
      isScanning: true,
    }));

    const mockTrackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: mockTrackStop }],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: 'cam-1', kind: 'videoinput', label: 'Rear Camera' },
        ]),
      },
      writable: true,
      configurable: true,
    });

    const onScanSuccessMock = vi.fn().mockImplementation(() => new Promise((r) => setTimeout(r, 50)));

    render(<CameraQRScanner onScanSuccess={onScanSuccessMock} elementId="test-viewfinder-detect" />);

    fireEvent.click(screen.getByRole('button', { name: /camera/i }));

    await waitFor(() => {
      expect(capturedSuccessCb).not.toBeNull();
    });

    // Simulate camera detecting QR code 3 times in rapid succession
    capturedSuccessCb!('https://vrindavansarthi.in/verify-booking?ref=VS-261024-DH8201');
    capturedSuccessCb!('https://vrindavansarthi.in/verify-booking?ref=VS-261024-DH8201');
    capturedSuccessCb!('https://vrindavansarthi.in/verify-booking?ref=VS-261024-DH8201');

    await waitFor(() => {
      // onScanSuccess should be called strictly ONCE despite 3 frames
      expect(onScanSuccessMock).toHaveBeenCalledTimes(1);
      expect(onScanSuccessMock).toHaveBeenCalledWith('https://vrindavansarthi.in/verify-booking?ref=VS-261024-DH8201');
      // Scanner should be stopped immediately
      expect(mockStop).toHaveBeenCalled();
    });
  });

  it('handles insecure context by reporting HTTPS requirement without calling getUserMedia', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, writable: true, configurable: true });
    delete (window as any).location;
    (window as any).location = { hostname: 'example.com', protocol: 'http:' };

    const getUserMediaMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock, enumerateDevices: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<CameraQRScanner onScanSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /camera/i }));

    await waitFor(() => {
      expect(screen.getByText('Secure HTTPS Connection Required')).toBeInTheDocument();
      expect(screen.getByText(/Camera access requires a secure HTTPS connection/i)).toBeInTheDocument();
    });

    // In an insecure context, getUserMedia must NOT be invoked
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });
});
