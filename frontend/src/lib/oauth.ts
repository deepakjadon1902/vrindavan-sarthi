import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from '@/lib/api';

const NATIVE_OAUTH_FRONTEND_ORIGIN = 'https://www.vrindavansarthi.in';

const getGoogleStartUrl = (redirect: string, isNative: boolean) => {
  const configuredBase = API_BASE_URL.replace(/\/+$/, '');
  const startUrl = /^https?:\/\//i.test(configuredBase)
    ? new URL(`${configuredBase}/auth/google`)
    : new URL('/api/auth/google', window.location.origin);

  startUrl.searchParams.set('redirect', redirect);
  if (isNative) {
    startUrl.searchParams.set('native', '1');
    startUrl.searchParams.set('origin', NATIVE_OAUTH_FRONTEND_ORIGIN);
  } else {
    startUrl.searchParams.set('origin', window.location.origin);
  }

  return startUrl.toString();
};

export const startGoogleSignIn = async (redirect = '/') => {
  const isNative = Capacitor.isNativePlatform();
  const url = getGoogleStartUrl(redirect, isNative);

  if (isNative) {
    await Browser.open({ url });
    return;
  }

  window.location.assign(url);
};
