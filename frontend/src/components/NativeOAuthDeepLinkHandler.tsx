import { useCallback, useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

const OAUTH_SCHEME = 'com.vrindavansarthi.app:';
const OAUTH_HOST = 'oauth';
const OAUTH_PATH = '/callback';

const NativeOAuthDeepLinkHandler = () => {
  const navigate = useNavigate();
  const handledUrls = useRef(new Set<string>());

  const handleUrl = useCallback((rawUrl: string) => {
    if (!Capacitor.isNativePlatform() || handledUrls.current.has(rawUrl)) return;

    let callbackUrl: URL;
    try {
      callbackUrl = new URL(rawUrl);
    } catch {
      return;
    }

    if (
      callbackUrl.protocol !== OAUTH_SCHEME ||
      callbackUrl.hostname !== OAUTH_HOST ||
      callbackUrl.pathname !== OAUTH_PATH
    ) {
      return;
    }

    handledUrls.current.add(rawUrl);
    void Browser.close().catch(() => undefined);

    const error = callbackUrl.searchParams.get('error');
    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    const token = callbackUrl.searchParams.get('token');
    if (!token) {
      navigate('/login?error=missing_oauth_token', { replace: true });
      return;
    }

    const params = new URLSearchParams({ token });
    const redirect = callbackUrl.searchParams.get('redirect');
    if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
      params.set('redirect', redirect);
    }
    navigate(`/auth/google/callback?${params.toString()}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;

    void App.addListener('appUrlOpen', ({ url }) => {
      if (active) handleUrl(url);
    }).then((registeredListener) => {
      listener = registeredListener;
      if (!active) void registeredListener.remove();
    }).catch((error: unknown) => {
      console.error('Unable to register the OAuth deep-link listener', error);
    });

    void App.getLaunchUrl().then((launch) => {
      if (active && launch?.url) handleUrl(launch.url);
    }).catch((error: unknown) => {
      console.error('Unable to read the app launch URL', error);
    });

    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, [handleUrl]);

  return null;
};

export default NativeOAuthDeepLinkHandler;
