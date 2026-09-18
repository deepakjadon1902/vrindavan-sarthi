# Phase 6 - Channel Manager / eZee Integration Foundation

## Status

Phase 6 implements the internal channel-manager foundation and fake/test provider boundary.

Live eZee API execution is intentionally not enabled in this phase because no official eZee endpoint contract, authentication scheme, request/response schema, or production-safe credentials are present in the repository. The `ezee` provider adapter is present as a guarded boundary and returns `EZEE_CONTRACT_NOT_CONFIGURED` for live write operations.

## Architecture

MongoDB remains the authoritative business datastore. `RoomUnitBookingDay` remains the physical inventory authority with the unique `{ roomUnitId, date }` invariant.

Channel-manager state is separated into durable operational records:

- `ChannelMapping`: maps internal hotels, room types, and rate plans to provider identifiers.
- `ChannelSyncOperation`: durable outbound/inbound operation intent and retry/reconciliation state.
- `ChannelInboundEvent`: durable inbound webhook/event inbox.
- `ExternalReservation`: durable record of provider reservations and their local booking/reconciliation status.

BullMQ executes channel sync work through the existing worker process and the new `vrindavan-sarthi-channel` queue. BullMQ is execution infrastructure only; it is not the source of truth.

## Provider Boundary

Provider abstraction lives under `backend/integrations/channelManager`.

Implemented providers:

- `fake`: deterministic test provider, no external calls.
- `ezee`: guarded adapter that requires the official eZee contract before live calls can be implemented.

Required future eZee contract details:

- base URL
- authentication method
- property, room type, rate plan mapping schema
- availability update schema
- rate update schema
- reservation create/modify/cancel payloads
- webhook signature verification method
- idempotency support
- error/status codes
- rate limits and retry guidance

## Mapping Model

Mappings are one-provider-to-one-internal-entity:

- provider + entity type + internal entity ID is unique
- provider + entity type + external entity ID is unique

Supported entity types:

- `hotel`
- `room_type`
- `rate_plan`

Partner access is scoped to the partner's one hotel. Admin access is global.

## Outbound Sync

Supported durable intents:

- `inventory_sync`
- `rate_sync`

Inventory sync validates:

- room type exists
- partner/admin ownership
- hotel mapping exists
- room type mapping exists
- requested date range is valid
- availability is calculated from internal inventory

Rate sync validates:

- rate plan exists
- partner/admin ownership
- hotel mapping exists
- room type mapping exists
- rate plan mapping exists
- requested date range is valid

The fake provider records deterministic calls for tests. The eZee adapter refuses live execution until the real contract is available.

## Inbound Reservations

Inbound provider events are first persisted as `ChannelInboundEvent`, then associated with a deterministic `ChannelSyncOperation`.

Inbound reservation processing:

1. maps external hotel and room type IDs
2. optionally maps external rate plan ID
3. records/updates `ExternalReservation`
4. creates an internal booking only if required mapping and customer user identity are available
5. acquires `RoomUnitBookingDay` locks before saving the booking
6. marks reconciliation when the event cannot be safely applied

If a provider reservation lacks a safe customer mapping, the system records the external reservation as `reconciliation_required` instead of guessing.

## Idempotency

Logical channel operations use deterministic keys:

`channel:<provider>:<operation>:<entityType>:<entityId/externalReservationId>:<from>:<to>`

MongoDB uniqueness on `{ provider, idempotencyKey }` is the final duplicate protection.

Inbound event idempotency uses unique `{ provider, eventId }`.

External reservation idempotency uses unique `{ provider, externalReservationId }`.

## Retry And Reconciliation

Operation states:

- `queued`
- `processing`
- `completed`
- `retry_scheduled`
- `failed`
- `reconciliation_required`

Provider failures are classified as:

- `retryable`: timeout, network reset, 408, 409, 425, 429, 5xx
- `permanent`: 4xx validation/auth errors
- `unknown`: ambiguous provider outcome
- `reconciliation_required`: internally safe handling is not possible

Retries are bounded by `maxAttempts`. Ambiguous provider outcomes must be reconciled manually or by a later provider-specific reconciliation phase.

## APIs

Mounted under `/api/channel`.

Protected APIs:

- `GET /mappings`
- `POST /mappings`
- `GET /operations`
- `POST /operations/:id/retry`
- `GET /reservations`
- `GET /inbound-events` admin only
- `POST /sync/inventory`
- `POST /sync/rates`

Webhook API:

- `POST /webhooks/:provider`

Webhook requests require `CHANNEL_WEBHOOK_SECRET` outside test context. The secret value is never logged.

## Admin UI

The admin panel includes a minimal Channel Manager page:

- mapping form
- mapping list
- manual inventory/rate sync enqueue controls
- recent sync operations
- recent external reservations

The Operations dashboard also includes channel sync counts and retry controls.

## Security

The implementation does not log:

- provider credentials
- Redis URLs
- MongoDB credentials
- customer secrets
- webhook signatures

Partner access remains scoped to the partner's hotel. Customers do not get channel-manager APIs.

## What Phase 6 Does Not Do

Phase 6 does not:

- perform live eZee calls
- invent eZee request/response schemas
- implement OTA/channel-specific business rules
- change reservation lifecycle
- change payment lifecycle
- change refund lifecycle
- change rate/inventory source of truth
- implement multi-hotel partners
- replace the existing booking engine

## Tests

Added foundation tests:

- queue/job naming
- deterministic operation keys
- provider error classification
- fake provider success/failure behavior
- guarded eZee adapter behavior
- schema idempotency indexes
- inbound payload normalization
- deterministic BullMQ job IDs

Command:

```bash
npm run test:channel
```

## Future Live eZee Implementation Sequence

1. Obtain official eZee contract and sandbox credentials.
2. Add eZee request signing/authentication.
3. Add provider-specific request/response DTO validation.
4. Add live availability sync integration tests against eZee sandbox.
5. Add live rate sync integration tests against eZee sandbox.
6. Add webhook signature tests using official algorithm.
7. Add inbound reservation sandbox tests.
8. Add reconciliation for ambiguous eZee provider outcomes.
9. Enable production eZee adapter behind environment flags.
10. Monitor operations dashboard before enabling broad partner rollout.
