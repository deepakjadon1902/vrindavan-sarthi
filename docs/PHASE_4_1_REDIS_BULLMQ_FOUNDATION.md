# Phase 4.1 Redis + BullMQ Durable Job Foundation

Status: infrastructure foundation only.

Phase 4.1 adds Redis/BullMQ primitives without migrating current reservation, payment, refund, webhook, expiration, invoice, or email workflows. MongoDB remains the authoritative business datastore. BullMQ is execution infrastructure only.

## Architecture

Runtime roles:

- API: `node server.js`
- Worker: `node worker.js`
- Queue backend: Redis via `REDIS_URL`
- Business state: MongoDB Atlas via existing `MONGO_URI` / `MONGODB_URI`

The API can start without Redis because no existing business route depends on BullMQ in Phase 4.1. The worker requires Redis and exits with a startup failure if `REDIS_URL` is missing.

## Dependencies

Added backend dependencies:

- `bullmq`
- `redis`

BullMQ is configured through a central queue factory. The code uses the official node-redis client instead of adding a second Redis client.

## Environment Variables

Server-only values:

```text
REDIS_URL=
BULLMQ_PREFIX=vrindavan-sarthi
WORKER_CONCURRENCY=2
JOB_ATTEMPTS_DEFAULT=1
JOB_BACKOFF_BASE_MS=30000
REDIS_CONNECT_TIMEOUT_MS=10000
```

Never expose or log `REDIS_URL`.

## Queue Names

Centralized queue names:

- `vrindavan-sarthi-booking`
- `vrindavan-sarthi-payment`
- `vrindavan-sarthi-refund`
- `vrindavan-sarthi-webhook`
- `vrindavan-sarthi-notification`
- `vrindavan-sarthi-reconciliation`

Phase 4.1 defines these queues but does not move current business workflows onto them.

## Configuration Modules

- `backend/config/redis.js`: Redis URL handling, prefix, bounded worker concurrency, default attempts, backoff, and node-redis client construction.
- `backend/queues/names.js`: queue and foundational job names.
- `backend/queues/factory.js`: BullMQ Queue, QueueEvents, and Worker creation with safe logging and shared defaults.

## Worker Behavior

`backend/worker.js` initializes a worker for each domain queue and supports a no-side-effect Phase 4.1 probe job. Unknown jobs are acknowledged as ignored because no business processors are active yet.

Shutdown:

- handles `SIGTERM`
- handles `SIGINT`
- closes BullMQ workers/queues
- exits cleanly after resources close

## Observability

Logs include:

- worker startup
- Redis configured status
- queue prefix
- queue initialization
- job started
- job completed
- job failed
- worker errors and shutdown

Logs intentionally omit payloads, Redis URLs, credentials, tokens, and customer-sensitive data.

## Health

`GET /api/health` now includes a minimal queue section:

```json
{
  "queue": {
    "provider": "bullmq",
    "configured": true
  }
}
```

This does not expose `REDIS_URL` and does not make API health depend on Redis availability.

## Local Development

`docker-compose.yml` includes a Redis service for local development:

```bash
docker compose up -d redis
```

Example local worker startup:

```bash
cd backend
npm run worker
```

The existing Phase 2.1 and Phase 3 Atlas integration tests still require `PHASE_2_1_MONGO_URI` and the database `vrindavan_sarthi_test`. They do not require Redis.

## Render Preparation

Recommended Render services:

- Web Service: `node server.js`
- Worker Service: `node worker.js`
- Managed Redis: supplies `REDIS_URL`
- MongoDB Atlas: existing production MongoDB configuration

Use distinct `BULLMQ_PREFIX` values for production, staging, and tests.

## Test Strategy

Phase 4.1 queue tests are isolated in:

```bash
npm run test:queue
```

They use fake Queue/Worker classes for configuration and lifecycle checks, so they do not enqueue into production Redis and do not require local Redis.

The existing baseline remains:

```bash
npm test
node --test tests/phase2-reservation.integration.test.js
node --test tests/phase3-modification.integration.test.js
npm run test:all
```

`npm run test:all` intentionally remains the Phase 2/3 regression suite and keeps its 65-test acceptance count.

## Security

- Do not commit `.env`.
- Do not log `REDIS_URL`.
- Do not log job payloads.
- Do not use production Redis in tests.
- Do not place payment credentials, MongoDB credentials, JWT secrets, or Redis credentials in job data.

## Not Migrated In Phase 4.1

The following remain on the existing synchronous/in-memory paths until later phases:

- Razorpay webhook processing
- Razorpay refund execution
- payment reconciliation
- booking expiration scheduling
- invoice sending
- booking/order notifications
- waitlist assignment
- password reset email
- contact email

## Deferred Outbox Points

Later phases should add durable intent or inbox/outbox records before moving these workflows:

- webhook receipt
- refund request
- payment reconciliation
- post-payment invoice
- modification-after-payment
- booking expiration

## Known Limitations

Phase 4.1 proves configuration and worker foundation only. It does not yet provide durable execution for existing production workflows.
