import { Download, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  role: 'admin' | 'partner';
};

const APK_DOWNLOAD_URL = '/downloads/vrindavan-sarthi.apk';

const isAndroidBrowser = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isNativeApk = localStorage.getItem('vrs_native_apk') === '1' || sessionStorage.getItem('vrs_native_apk') === '1';
  return isAndroid && !isNativeApk;
};

const AndroidApkDownloadPrompt = ({ role }: Props) => {
  const storageKey = useMemo(() => `vrs_apk_download_prompt_dismissed_${role}`, [role]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAndroidBrowser()) return;
    setVisible(localStorage.getItem(storageKey) !== 'yes');
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, 'yes');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 py-3 text-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-crimson text-white">
          <Smartphone size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold">Download Android app</p>
          <p className="mt-1 font-body text-xs leading-5 text-muted-foreground">
            Use the app for booking alarms and lock-screen notifications on this {role} device.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={APK_DOWNLOAD_URL}
              download="vrindavan-sarthi.apk"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-brand-crimson px-3 py-2 font-body text-xs font-semibold text-white hover:bg-brand-crimson/90"
            >
              <Download size={14} /> Download APK
            </a>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 font-body text-xs font-semibold hover:bg-muted"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss app download prompt"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default AndroidApkDownloadPrompt;
