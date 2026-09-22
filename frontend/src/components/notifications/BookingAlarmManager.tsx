import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, Check, MonitorSmartphone, Settings, Volume2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import type { User } from '@/types/auth.types';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  priority?: 'normal' | 'high' | 'critical';
  eventType?: string;
  entityId?: string;
  bookingId?: string;
  alarmStatus?: 'created' | 'delivered' | 'alarming' | 'acknowledged' | 'expired';
  alarmExpiresAt?: string;
  acknowledgedAt?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

type DeviceItem = {
  _id: string;
  deviceId: string;
  platform?: string;
  browser?: string;
  permissionStatus?: string;
  alarmEnabled?: boolean;
  lastSeenAt?: string;
};

type Props = {
  token: string | null;
  user: User | null;
  enabled?: boolean;
  viewPath: string;
  onNewBooking?: () => void;
};

const pollMs = 15_000;

const getDeviceId = () => {
  const key = 'vvs_notification_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
};

const getPermissionStatus = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

const permissionCopy = {
  default: 'Important: allow notifications on every admin/partner device so booking alarms can appear in the device notification center.',
  granted: 'Device notifications are enabled on this browser.',
  denied: 'Important: device notifications are blocked in this browser. Enable them from site settings to receive booking alarms.',
  unsupported: 'This browser does not support device notifications. In-app booking alarms still work.',
};

const getPlatform = () => navigator.platform || 'Browser';
const getBrowser = () => {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
};

const isActiveAlarm = (n: NotificationItem, now = Date.now()) => {
  if (n.priority !== 'critical' || n.eventType !== 'BOOKING_CONFIRMED') return false;
  if (n.acknowledgedAt || n.alarmStatus === 'acknowledged') return false;
  const expires = n.alarmExpiresAt ? new Date(n.alarmExpiresAt).getTime() : 0;
  return !expires || expires > now;
};

const BookingAlarmManager = ({ token, user, enabled = true, viewPath, onNewBooking }: Props) => {
  const navigate = useNavigate();
  const deviceId = useMemo(getDeviceId, []);
  const audioRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('vvs_booking_alarm_sound') !== 'off');
  const [permissionStatus, setPermissionStatus] = useState(getPermissionStatus);
  const [nowTick, setNowTick] = useState(Date.now());
  const activeAlarm = notifications.find((n) => isActiveAlarm(n, nowTick));
  const unreadCriticalCount = notifications.filter((n) => n.priority === 'critical' && !n.acknowledgedAt).length;
  const recentCritical = notifications.filter((n) => n.priority === 'critical' && n.eventType === 'BOOKING_CONFIRMED').slice(0, 5);
  const shouldShowPermissionPrompt = permissionStatus !== 'granted';

  const stopSound = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    void audioRef.current?.close().catch(() => undefined);
    audioRef.current = null;
  }, []);

  const playPulse = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current || new Ctx();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Browser autoplay policy can block sound. Visual and persisted alerts remain active.
    }
  }, []);

  const startSound = useCallback(() => {
    if (!soundEnabled || intervalRef.current || !activeAlarm) return;
    playPulse();
    intervalRef.current = window.setInterval(playPulse, 1800);
  }, [activeAlarm, playPulse, soundEnabled]);

  const registerDevice = useCallback(async (permission = permissionStatus, alarmEnabled = soundEnabled) => {
    if (!token || !enabled) return;
    await api.post('/notifications/devices', {
      deviceId,
      platform: getPlatform(),
      browser: getBrowser(),
      permissionStatus: permission,
      alarmEnabled,
    }, withAuth(token));
  }, [deviceId, enabled, permissionStatus, soundEnabled, token]);

  const loadDevices = useCallback(async () => {
    if (!token || !enabled) return;
    try {
      const res = await api.get('/notifications/devices', withAuth(token));
      setDevices(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      // Device history is helpful, but the alarm path remains usable without it.
    }
  }, [enabled, token]);

  const loadNotifications = useCallback(async () => {
    if (!token || !enabled) return;
    try {
      const res = await api.get('/notifications', { ...withAuth(token), params: { limit: 50 } });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setNotifications(list);
      setNowTick(Date.now());
      const latestCritical = list.find((n: NotificationItem) => n.priority === 'critical' && n.eventType === 'BOOKING_CONFIRMED');
      if (latestCritical?._id && !seenRef.current.has(latestCritical._id)) {
        seenRef.current.add(latestCritical._id);
        if (!sessionStorage.getItem(`vvs_seen_alarm_${latestCritical._id}`)) {
          sessionStorage.setItem(`vvs_seen_alarm_${latestCritical._id}`, '1');
          const active = isActiveAlarm(latestCritical);
          toast.info(active ? (latestCritical.title || 'Booking confirmed') : 'Missed booking alert', {
            description: latestCritical.message,
          });
          onNewBooking?.();
          if (permissionStatus === 'granted') {
            try {
              new Notification(active ? (latestCritical.title || 'Booking confirmed') : 'Missed booking alert', {
                body: latestCritical.message,
                tag: latestCritical._id,
                requireInteraction: active,
                silent: false,
              });
            } catch {
              // In-app alarm still covers unsupported browser notification delivery.
            }
          }
        }
      }
    } catch {
      // Keep the existing visual/audio state if a poll fails.
    }
  }, [enabled, onNewBooking, permissionStatus, token]);

  useEffect(() => {
    if (!token || !enabled) {
      stopSound();
      return;
    }
    void registerDevice().catch(() => undefined);
    void loadDevices();
    void loadNotifications();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void registerDevice().catch(() => undefined);
        void loadNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadNotifications();
    }, pollMs);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(id);
    };
  }, [enabled, loadDevices, loadNotifications, registerDevice, stopSound, token]);

  useEffect(() => {
    if (activeAlarm) startSound();
    else stopSound();
    return stopSound;
  }, [activeAlarm, startSound, stopSound]);

  useEffect(() => {
    if (!activeAlarm?.alarmExpiresAt) return;
    const expiresAt = new Date(activeAlarm.alarmExpiresAt).getTime();
    const delay = Math.max(0, expiresAt - Date.now());
    const id = window.setTimeout(() => {
      setNowTick(Date.now());
      stopSound();
    }, delay + 100);
    return () => window.clearTimeout(id);
  }, [activeAlarm?._id, activeAlarm?.alarmExpiresAt, stopSound]);

  const requestPermission = async () => {
    let permission = getPermissionStatus();
    if (permission === 'unsupported') {
      toast.info('This browser does not support device notifications');
      await registerDevice(permission).catch(() => undefined);
      return;
    }
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    setPermissionStatus(permission);
    await registerDevice(permission).catch(() => undefined);
    await loadDevices();
    if (permission === 'granted') toast.success('Booking device notifications enabled');
    if (permission === 'denied') toast.error('Device notifications are blocked in browser settings');
  };

  const acknowledge = async (id?: string) => {
    const notificationId = id || activeAlarm?._id;
    if (!token || !notificationId) return;
    stopSound();
    try {
      const res = await api.post(`/notifications/${notificationId}/acknowledge`, { deviceId }, withAuth(token));
      const updated = res.data?.data;
      setNotifications((prev) => prev.map((n) => (n._id === notificationId ? { ...n, ...updated } : n)));
    } catch {
      toast.error('Could not acknowledge booking alert');
      void loadNotifications();
    }
  };

  const revokeDevice = async (id: string) => {
    if (!token) return;
    try {
      await api.delete(`/notifications/devices/${encodeURIComponent(id)}`, withAuth(token));
      await loadDevices();
    } catch {
      toast.error('Could not revoke this device');
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('vvs_booking_alarm_sound', next ? 'on' : 'off');
    if (!next) stopSound();
    void registerDevice(permissionStatus, next).catch(() => undefined);
  };

  const viewBooking = () => {
    if (activeAlarm) void acknowledge(activeAlarm._id);
    navigate(viewPath);
  };

  if (!enabled || !token || !user) return null;

  return (
    <>
      <div className="relative flex items-center gap-2">
        {shouldShowPermissionPrompt && (
          <button
            type="button"
            onClick={requestPermission}
            className="hidden rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100 lg:inline-flex"
            title="Important: enable booking alarm notifications on this device"
          >
            Enable Alerts
          </button>
        )}
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20"
          aria-label="Booking alert settings"
          title="Booking alert settings"
        >
          {unreadCriticalCount > 0 ? <BellRing size={17} /> : <Bell size={17} />}
          {unreadCriticalCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCriticalCount}
            </span>
          )}
        </button>
        {settingsOpen && (
          <div className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] rounded-lg border border-border bg-card p-4 text-foreground shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold">Booking Alerts</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded p-1 hover:bg-muted" aria-label="Close settings">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {shouldShowPermissionPrompt && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                  <p className="text-sm font-semibold">Notification permission is important</p>
                  <p className="mt-1 text-xs">Please enable it on every admin and partner device that uses this application.</p>
                </div>
              )}
              <button type="button" onClick={requestPermission} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-muted">
                <span>Browser Notifications</span>
                <span className="text-xs uppercase text-muted-foreground">{permissionStatus}</span>
              </button>
              <p className="text-xs text-muted-foreground">{permissionCopy[permissionStatus as keyof typeof permissionCopy]}</p>
              <button type="button" onClick={toggleSound} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-muted">
                <span>Alarm Sound</span>
                <span className="text-xs uppercase text-muted-foreground">{soundEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <BellRing size={14} /> Recent Booking Alerts
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {recentCritical.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No booking alerts yet.</p>
                  ) : recentCritical.map((item) => {
                    const active = isActiveAlarm(item, nowTick);
                    return (
                      <div key={item._id} className="rounded-md border border-border px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                          </div>
                          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {item.acknowledgedAt ? 'ack' : active ? 'active' : 'missed'}
                          </span>
                        </div>
                        {!item.acknowledgedAt && (
                          <button type="button" onClick={() => acknowledge(item._id)} className="mt-2 text-xs font-semibold text-red-700">
                            Accept Alert
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <MonitorSmartphone size={14} /> Registered Devices
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {devices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This device will appear after alerts are enabled.</p>
                  ) : devices.map((device) => (
                    <div key={device._id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{device.browser || 'Browser'} - {device.platform || 'Device'}</p>
                        <p className="text-xs text-muted-foreground">{device.permissionStatus || 'default'}</p>
                      </div>
                      <button type="button" onClick={() => revokeDevice(device.deviceId)} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Revoke device">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeAlarm && (
        <div role="alertdialog" aria-live="assertive" className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-3xl rounded-lg border border-red-300 bg-white p-4 text-slate-950 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
              <BellRing size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase text-red-700">Critical booking alert</p>
              <h2 className="font-heading text-lg font-semibold">{activeAlarm.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{activeAlarm.message}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={viewBooking} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                <Settings size={15} /> View Booking
              </button>
              <button type="button" onClick={() => acknowledge(activeAlarm._id)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100">
                <Check size={15} /> Accept Alert
              </button>
            </div>
          </div>
          {shouldShowPermissionPrompt && (
            <button type="button" onClick={requestPermission} className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
              <Bell size={14} /> Enable device notification center alerts
            </button>
          )}
          {!soundEnabled && (
            <button type="button" onClick={toggleSound} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-red-700">
              <Volume2 size={14} /> Enable alarm sound on this device
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default BookingAlarmManager;
