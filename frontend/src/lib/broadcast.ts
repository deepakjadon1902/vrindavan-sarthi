export type AppEventType = 'listing:changed' | 'product:changed';

type AppEvent = { type: AppEventType; ts: number };
type Unsubscribe = () => void;

const CHANNEL_NAME = 'vvs-events';
const STORAGE_KEY = 'vvs_event';

export const publishAppEvent = (type: AppEventType) => {
  const msg: AppEvent = { type, ts: Date.now() };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage(msg);
      ch.close();
      return;
    }
  } catch {
    // fall back to storage
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const subscribeAppEvent = (type: AppEventType, cb: () => void): Unsubscribe => {
  let closed = false;
  let ch: BroadcastChannel | null = null;

  const onMsg = (msg: any) => {
    if (closed) return;
    if (!msg || msg.type !== type) return;
    cb();
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => onMsg(e.data);
    }
  } catch {
    ch = null;
  }

  const onStorage = (e: StorageEvent) => {
    if (closed) return;
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as AppEvent;
      onMsg(parsed);
    } catch {
      // ignore
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    closed = true;
    window.removeEventListener('storage', onStorage);
    try {
      ch?.close();
    } catch {
      // ignore
    }
  };
};

