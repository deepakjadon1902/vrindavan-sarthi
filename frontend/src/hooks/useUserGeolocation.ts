import { useState, useCallback, useEffect } from 'react';
import type { GeoCoordinates } from '@/lib/geoDiscovery';

export type GeolocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface UseUserGeolocationReturn {
  coords: GeoCoordinates | null;
  status: GeolocationStatus;
  errorMessage: string | null;
  requestLocation: () => void;
  clearLocation: () => void;
  isSupported: boolean;
}

export function useUserGeolocation(): UseUserGeolocationReturn {
  const isSupported = typeof window !== 'undefined' && 'geolocation' in navigator;
  const [coords, setCoords] = useState<GeoCoordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!isSupported) {
      setStatus('unavailable');
      setErrorMessage('Browser geolocation is not supported on this device.');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus('granted');
        setErrorMessage(null);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus('denied');
          setErrorMessage('Location permission was denied. You can still choose your preferred Braj landmark.');
        } else if (error.code === error.TIMEOUT) {
          setStatus('unavailable');
          setErrorMessage('Location request timed out. Showing standard Braj landmark listings.');
        } else {
          setStatus('unavailable');
          setErrorMessage('Unable to retrieve location. Showing standard Braj landmark listings.');
        }
        setCoords(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [isSupported]);

  const clearLocation = useCallback(() => {
    setCoords(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return {
    coords,
    status,
    errorMessage,
    requestLocation,
    clearLocation,
    isSupported,
  };
}
