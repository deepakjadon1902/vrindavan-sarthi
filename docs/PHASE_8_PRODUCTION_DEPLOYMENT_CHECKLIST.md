# Phase 8 Production Deployment Checklist

## Pre-Deployment

- [ ] Confirm full regression passes in an isolated test environment.
- [ ] Confirm no production credentials are present in source control.
- [ ] Confirm `.env.example` contains placeholders only.
- [ ] Confirm MongoDB Atlas production cluster is separate from test Atlas database.
- [ ] Confirm Redis production instance is separate from test/development Redis.

## Render API Service

- [ ] Start command: `node server.js`
- [ ] Set `NODE_ENV=production`
- [ ] Set `MONGO_URI`
- [ ] Set strong `JWT_SECRET`
- [ ] Set `FRONTEND_BASE_URL` and/or `CORS_ORIGINS`
- [ ] Set Razorpay variables if payments are enabled
- [ ] Set Cloudinary variables if image uploads are enabled
- [ ] Confirm `/api/health` returns `200`
- [ ] Confirm `/api/readiness` returns `200` after MongoDB is connected

## Render Worker Service

- [ ] Start command: `node worker.js`
- [ ] Set `NODE_ENV=production`
- [ ] Set `MONGO_URI`
- [ ] Set `REDIS_URL`
- [ ] Set `BULLMQ_PREFIX`
- [ ] Enable only intended worker jobs
- [ ] Confirm worker starts without production config errors
- [ ] Confirm no worker uses localhost Redis/MongoDB

## Vercel Frontend

- [ ] Set production API base URL/proxy.
- [ ] Confirm no localhost API URL is bundled into production.
- [ ] Run production build.
- [ ] Confirm auth, booking, payment, admin, partner, operations, and channel UI load correctly.

## MongoDB Atlas

- [ ] Backups enabled.
- [ ] Restore tested into non-production.
- [ ] IP/network access restricted.
- [ ] Least-privilege database users configured.
- [ ] Indexes reviewed before traffic.

## Redis

- [ ] Managed Redis configured.
- [ ] TLS/password configured where provider supports it.
- [ ] Prefix isolates environment.
- [ ] Queue backlog/failed jobs monitored.

## Payments

- [ ] Razorpay key ID and secret configured server-side only.
- [ ] Razorpay webhook secret configured.
- [ ] Webhook endpoint configured in Razorpay dashboard.
- [ ] Test-mode smoke test completed before live traffic.
- [ ] No real production refund executed during automated tests.

## Email / Notifications

- [ ] Resend or SMTP configured.
- [ ] Sender domain verified.
- [ ] Failed notification visibility checked in admin operations.

## Channel Manager

- [ ] Real OTA/provider integration remains disabled until official credentials/contracts exist.
- [ ] `CHANNEL_WEBHOOK_SECRET` configured before enabling provider webhooks.

## Smoke Tests

- [ ] Health/readiness.
- [ ] Customer registration/login.
- [ ] Hotel browse and availability.
- [ ] Booking creation.
- [ ] Razorpay test payment flow.
- [ ] Webhook processing.
- [ ] Cancellation/refund intent.
- [ ] Modification preview/apply.
- [ ] Partner isolation.
- [ ] Admin operations.
- [ ] Notification delivery with test recipient.
- [ ] Channel provider disabled-state safety.

## Rollback

- [ ] Previous Render deployment version known.
- [ ] Frontend rollback version known.
- [ ] No destructive migration pending.
- [ ] Reconciliation runbook available.
