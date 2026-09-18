# Phase 7 - OTA / Multi-Channel Distribution Engine

## Status

Phase 7 implements a provider-neutral OTA distribution foundation on top of the Phase 6 channel-manager layer.

Real OTA provider execution remains safely disabled because no official contracts, sandbox credentials, webhook schemas, or provider idempotency guarantees are available in the repository. The implementation supports fake-provider testing and disabled provider adapters for future providers such as Booking.com, Agoda, Expedia, MakeMyTrip, and eZee.

## Audit Summary

Existing reusable components:

- `ChannelMapping`
- `ChannelSyncOperation`
- `ChannelInboundEvent`
- `ExternalReservation`
- `backend/integrations/channelManager`
- `backend/utils/channelManager.js`
- `backend/routes/channel.routes.js`
- `vrindavan-sarthi-channel` BullMQ queue
- Phase 5 `RatePlan`, `RateCalendar`, and `rateEngine`
- Phase 2/3 `RoomUnitBookingDay` inventory locking and booking lifecycle
- Phase 4 durable worker, reconciliation, refund, webhook, and notification patterns

Gaps addressed in Phase 7:

- channel connection model
- provider capability discovery
- disabled real-provider adapters
- channel reconciliation model
- duplicate inbound payload conflict state
- outbound stale-operation protection
- correlation/request IDs
- broader fake provider simulation
- partner/admin connection and reconciliation API visibility

## Core Architecture

MongoDB remains the authoritative business datastore.

`RoomUnitBookingDay` remains the only authoritative physical room-night lock. OTA/provider availability is derived from internal physical inventory and is never trusted as inventory truth.

`RatePlan` and `RateCalendar` remain the internal rate authority. OTA rates are outbound projections of internal rates, not a second rate engine.

BullMQ is used for durable execution. It is not business source of truth.

## Models

### ChannelConnection

Represents a provider connection for one hotel.

Important fields:

- provider
- hotelId
- enabled
- status
- environment
- externalHotelId
- credentialsReference
- capabilities
- health timestamps
- lastError

Credentials are represented by a reference only. Plaintext provider secrets are not stored or exposed.

### ChannelMapping

Maps internal entities to provider identifiers.

Supported mapping types:

- hotel
- room_type
- rate_plan

Room-unit mapping is intentionally not added because no available provider contract proves physical-room-level mapping is required.

### ChannelSyncOperation

Durable intent for outbound and inbound channel work.

Supported operations:

- inventory_sync
- rate_sync
- reservation_inbound
- reservation_create
- reservation_modify
- reservation_cancel
- webhook_process
- reconciliation

States:

- queued
- processing
- completed
- retry_scheduled
- failed
- reconciliation_required

### ChannelInboundEvent

Durable inbox for provider webhooks/events.

Duplicate provider event IDs are protected by unique `{ provider, eventId }`.

If the same event ID arrives with a different payload hash, the event is marked `duplicate_conflict` and a `ChannelReconciliation` record is created.

### ExternalReservation

Durable record of provider reservations and their local booking relationship.

Unique `{ provider, externalReservationId }` prevents duplicate external reservations.

### ChannelReconciliation

Durable issue record for manual or future automated reconciliation.

Reasons include:

- missing_mapping
- payload_conflict
- out_of_order_event
- inventory_conflict
- unsupported_operation
- provider_unknown_outcome
- provider_contract_missing
- relationship_invalid
- manual_review

## Provider Abstraction

Provider adapters expose a common interface:

- getCapabilities
- healthCheck
- getHotel
- getRoomTypes
- getRatePlans
- getAvailability
- getRates
- updateAvailability
- updateRates
- createReservation
- modifyReservation
- cancelReservation

Unsupported or unconfigured operations throw controlled provider errors.

## Providers

Enabled for automated testing:

- `fake`

Safely disabled:

- `ezee`
- `booking_com`
- `agoda`
- `expedia`
- `makemytrip`
- `ota_provider_a`
- `ota_provider_b`

Disabled providers never return fake success and never make external calls.

## Inventory Flow

1. Internal inventory change occurs.
2. A sync request resolves the room type and hotel ownership.
3. Internal availability is calculated from:
   - `RoomUnit`
   - `RoomUnitBookingDay`
   - `RoomUnitBlock`
4. Active mappings are validated.
5. A deterministic `ChannelSyncOperation` is created.
6. BullMQ processes the operation.
7. Provider adapter receives only derived availability.
8. Result is recorded as completed, retryable, failed, or reconciliation required.

## Rate Flow

1. Rate plan or rate calendar changes.
2. A sync request resolves `RatePlan`.
3. Hotel/room/rate mappings are validated.
4. A deterministic `ChannelSyncOperation` is created.
5. Provider receives supported rate fields.
6. Unsupported real-provider operations fail safely until the official contract exists.

## Reservation Flow

Inbound provider reservation events:

1. webhook signature is checked
2. event is persisted as `ChannelInboundEvent`
3. deterministic operation is created
4. worker normalizes the payload
5. mappings are resolved
6. internal availability is checked
7. internal booking is created only when safe customer mapping exists
8. room-night locks are acquired through existing lifecycle helpers
9. conflicts become reconciliation

External price is stored as external financial data only. Internal booking pricing is recalculated through the internal rate/pricing logic.

## Modification Flow

External modification events are not blindly applied without a provider contract. They create reconciliation records. Future provider-specific implementation must route through the existing Phase 3 modification service.

## Cancellation Flow

External cancellation events for already-linked external reservations use the existing booking lifecycle and `releaseBookingInventory`. Unknown or out-of-order cancellations become reconciliation.

## Idempotency

Operation key format:

`channel:<provider>:<operation>:<entityType>:<entityId/externalReservationId>:<from>:<to>`

Reconciliation key format:

`channel-reconciliation:<provider>:<reason>:<operationId/externalReservationId/eventId>`

MongoDB unique indexes are the final duplicate protection.

## Stale Update Protection

Outbound inventory/rate operations carry `generatedAt` and `stateVersion`.

Before calling a provider, the worker checks whether a newer operation exists for the same provider, operation, entity type, and entity ID. Older operations are completed as `stale_outbound_operation_skipped` and do not call the provider.

## Retry Policy

Retryable:

- timeout
- connection reset
- DNS temporary failure
- HTTP 408
- HTTP 409
- HTTP 425
- HTTP 429
- provider 5xx

Permanent:

- invalid credentials
- invalid payload
- unsupported operation
- provider contract not configured
- provider 4xx validation errors

Unknown:

- ambiguous response loss
- provider outcome cannot be proven

Unknown outcomes create reconciliation instead of blind non-idempotent retry.

## Security

Admin:

- global access

Partner:

- scoped to their own hotel through server-side hotel lookup

Customer:

- no channel-manager access

Secrets are not logged or returned through APIs.

## API Surface

Mounted under `/api/channel`.

- `GET /providers/:provider/health`
- `GET /providers/:provider/capabilities`
- `GET /connections`
- `POST /connections`
- `GET /mappings`
- `POST /mappings`
- `GET /operations`
- `POST /operations/:id/retry`
- `GET /reservations`
- `GET /reconciliation`
- `GET /inbound-events`
- `POST /sync/inventory`
- `POST /sync/rates`
- `POST /webhooks/:provider`

## Environment Variables

Safe placeholders:

- `CHANNEL_PROVIDER_ENABLED=false`
- `CHANNEL_SYNC_ENABLED=false`
- `CHANNEL_WEBHOOK_SECRET=`
- `CHANNEL_DEFAULT_PROVIDER=ezee`
- `EZEE_API_BASE_URL=`
- `EZEE_API_KEY=`

No real provider credentials are committed.

## Testing

Phase 7 adds:

```bash
npm run test:ota
```

Coverage includes:

- provider registry
- provider capabilities
- disabled real-provider adapters
- operation key determinism
- reconciliation key determinism
- schema uniqueness/indexes
- inbound normalization
- external price non-authority
- fake provider idempotency
- provider error classification
- duplicate payload conflict state
- eZee safety gate

## Known Limitations

- No real OTA provider is enabled.
- No live eZee calls are enabled.
- External modifications are routed to reconciliation until an official provider contract is available.
- Live OTA webhook signature algorithms require official provider docs.
- Live provider reconciliation requires official query APIs and idempotency semantics.

## Required Future Provider Contracts

For any real provider:

- authentication method
- base URL
- sandbox credentials
- availability schema
- rate schema
- restriction schema
- reservation schema
- modification schema
- cancellation schema
- webhook signature algorithm
- idempotency support
- provider status/error code documentation
- rate limits
- reconciliation/query APIs

## Must Not Change

- MongoDB/Mongoose
- Express/CommonJS
- React/Vite
- RoomUnitBookingDay authority
- unique room-night index
- Phase 3 modification service
- Phase 4 durable payment/refund/reconciliation infrastructure
- Phase 5 rate engine
- one-hotel-per-partner model
- admin global access
- partner isolation
