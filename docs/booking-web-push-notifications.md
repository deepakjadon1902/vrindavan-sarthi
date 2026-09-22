# Booking Web Push Notifications

## Architecture

Booking confirmation creates a durable `PartnerNotification` for every server-resolved recipient: all admins and the exact property partner. The same flow creates `NotificationDelivery` records for in-app delivery and Web Push delivery. BullMQ processes delivery jobs through the existing notification queue.

MongoDB notification state remains the source of truth. Web Push is the primary out-of-page delivery layer when supported, and authenticated polling remains the recovery/fallback layer.

## Environment

Set stable VAPID keys per environment:

```env
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=mailto:admin@vrindavansarthi.com
```

Do not generate new VAPID keys on every deploy. Changing keys invalidates existing browser subscriptions.

## Device Flow

Admins and approved partners see an alert enablement control. After a user click, the browser permission prompt opens. If permission is granted, the frontend registers `/vrs-service-worker.js`, subscribes with `PushManager`, and sends the subscription to `/api/notifications/devices`.

Identity is always taken from the authenticated JWT. Client-provided `userId`, `role`, `partnerId`, or `hotelId` is ignored.

## Service Worker

`frontend/public/vrs-service-worker.js` receives push payloads, displays OS/browser notifications, and handles notification clicks. Click navigation is restricted to same-origin admin/partner booking routes.

## Alarm Lifecycle

The server persists `alarmStartedAt`, `alarmExpiresAt`, and `acknowledgedAt`. The browser does not start a fresh three-minute alarm on refresh or reconnect. `BOOKING_ALARM_DURATION_SECONDS` defaults to 180 seconds.

## Invalid Subscriptions

If a push provider returns subscription expiration or invalid-subscription status, the worker disables push for that device and keeps audit history. Users can re-enable alerts by granting/registering again from the app.

## Limitations

Web Push is best-effort. Delivery can be blocked by browser permission, OS notification settings, Do Not Disturb, unsupported browsers, battery restrictions, offline devices, expired subscriptions, or push provider/network outages. In-app polling and notification history provide recovery when the user returns.

## Manual UAT Matrix

Test at least:

- Windows Chrome
- Windows Edge
- Android Chrome
- macOS Safari or another supported browser

For each device/browser record: permission, push registration, notification display, notification click, deep link, alarm UI, alarm sound where permitted, acknowledgement, refresh recovery, revocation, and offline/reconnect behavior.
