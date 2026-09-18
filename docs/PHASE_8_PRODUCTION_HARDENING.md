# Phase 8 Production Hardening

## Architecture

Vrindavan Sarthi remains an Express/CommonJS, MongoDB/Mongoose, React/Vite application. Phase 8 adds production guardrails around the established systems rather than replacing them.

MongoDB is still the authoritative business datastore. Redis/BullMQ executes durable background jobs. External providers such as Razorpay, email providers, Cloudinary, and future OTA providers are side-effect boundaries, not sources of truth.

## Implemented Controls

- Production configuration validation:
  - strong `JWT_SECRET`
  - no localhost MongoDB in production
  - no wildcard production CORS
  - Redis required for worker/enabled durable jobs
  - channel webhook secret required when channel providers are enabled
- Request hardening:
  - security headers
  - configurable body limits
  - NoSQL operator/dotted-key rejection
  - endpoint-specific rate limits
  - safer production error responses
- Reliability:
  - `/api/health` liveness endpoint
  - `/api/readiness` readiness endpoint
  - graceful API shutdown
  - worker config validation and MongoDB disconnect on shutdown

## CSRF Model

The application uses bearer tokens sent in the `Authorization` header. Browsers do not attach those tokens automatically the way cookies are attached, so classic CSRF risk is low. The main browser security risk is XSS, because the token is stored in localStorage. Backend authorization remains authoritative and must not rely on frontend guards.

## Rate Limiting

Phase 8 uses conservative in-memory rate limits on high-risk endpoints. This protects a single Render instance. For multiple API instances, a Redis-backed distributed limiter should replace the memory store in a later infrastructure pass.

## Security Headers

The backend now sends basic hardening headers. A strict Content-Security-Policy was not added because the frontend is deployed separately and CSP should be validated against production assets before enforcement.

## Production Configuration

Required production variables include:

- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_BASE_URL` or `CORS_ORIGINS`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `REDIS_URL` for workers and enabled durable jobs
- `CHANNEL_WEBHOOK_SECRET` when channel providers are enabled

Optional/configurable:

- `JSON_BODY_LIMIT`
- `URLENCODED_BODY_LIMIT`
- `REDIS_REQUIRED`
- `MONGO_MAX_POOL_SIZE`
- `MONGO_MIN_POOL_SIZE`

## Known Limitations

- Rate limiting is per-process until backed by Redis.
- File upload content validation still relies on MIME type and Cloudinary processing.
- External backup, alerting, DNS, and Render/Vercel settings must be verified outside the repository.
- Real OTA providers remain disabled until official contracts and credentials exist.
