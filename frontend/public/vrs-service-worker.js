const SAFE_PATHS = ['/admin/bookings', '/partner/bookings'];

const safeDeepLink = (value) => {
  try {
    const url = new URL(value || '/', self.location.origin);
    if (url.origin !== self.location.origin) return '/';
    if (SAFE_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
      return `${url.pathname}${url.search || ''}${url.hash || ''}`;
    }
  } catch {
    return '/';
  }
  return '/';
};

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const notificationId = String(payload.notificationId || '');
  const title = String(payload.title || 'Vrindavan Sarthi booking alert');
  const body = String(payload.body || 'A booking notification is waiting.');
  const deepLink = safeDeepLink(payload.deepLink);

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: notificationId || undefined,
    renotify: Boolean(notificationId),
    requireInteraction: payload.priority === 'critical',
    data: {
      notificationId,
      bookingId: String(payload.bookingId || ''),
      deepLink,
      type: String(payload.type || ''),
    },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = safeDeepLink(event.notification.data?.deepLink);
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin) {
        if ('navigate' in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
