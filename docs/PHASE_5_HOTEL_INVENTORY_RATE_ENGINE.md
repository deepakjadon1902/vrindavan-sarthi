# Phase 5 Hotel Inventory, Availability And Rate Engine

## Objective

Phase 5 introduces the internal hotel rate engine that separates physical inventory from selling configuration and pricing. It prepares the platform for future channel-manager work without implementing eZee, OTA, or external inventory sync.

## Existing Architecture

- `Hotel` owns `RoomType`.
- `RoomType` owns physical `RoomUnit` records.
- `RoomUnitBookingDay` remains the authoritative occupied-day lock with unique `{ roomUnitId, date }`.
- `RoomUnitBlock` represents manual physical-room blocks.
- `RoomType.pricePerNight` remains the backward-compatible legacy price.

## New Architecture

- `RatePlan` belongs to one `RoomType`.
- `RateCalendar` belongs to one `RatePlan` for one date.
- The quote engine resolves nightly prices from calendar overrides first, then the rate plan default.
- The availability engine counts physical room units once. Multiple rate plans never multiply inventory.

## RatePlan Model

`backend/models/RatePlan.js` stores:

- hotel, room type, partner references.
- name, code, meal plan.
- cancellation/payment policy labels.
- base price and currency.
- occupancy override rules.
- stay restrictions.
- active/default flags.

Important indexes:

- unique `{ hotelId, roomTypeId, code }`.
- unique default plan per room type.

## RateCalendar Model

`backend/models/RateCalendar.js` stores date-specific overrides:

- price.
- minimum/maximum stay.
- closed.
- closed to arrival.
- closed to departure.
- advance booking limits.

Important index:

- unique `{ ratePlanId, date }`.

Dates use the existing UTC date-only convention.

## Availability Engine

`backend/utils/rateEngine.js` provides `getRoomTypeAvailability()`.

It considers:

- active/available `RoomUnit` records.
- overlapping `RoomUnitBlock` records.
- existing `RoomUnitBookingDay` locks.
- pet eligibility.

The result is physical availability for the stay, not per-rate-plan inventory.

## Quote Engine

`createBookingQuote()` returns:

- rate plan identity.
- nightly breakdown.
- base amount.
- existing GST/fee/advance calculation fields.
- availability count when requested.

The quote engine calls the existing pricing utility path through `calculateLodgingPriceFromBase()`, preserving GST, convenience fee, gateway fee, commission, advance, and balance behavior.

## Booking Integration

`POST /api/bookings/room-type` now:

- accepts optional `ratePlanId`.
- recalculates all prices server-side.
- stores selected rate-plan fields and nightly breakdown on `Booking`.
- keeps the existing atomic physical room reservation flow.

If no rate plan is supplied, the system creates or reuses a default rate plan derived from `RoomType.pricePerNight`.

## Modification Integration

Booking modification now allows `ratePlanId` as a controlled business field and rebuilds modification price using the same quote engine. Existing inventory-safe modification behavior remains unchanged.

## APIs

Public:

- `GET /api/rates/room-types/:roomTypeId/plans`
- `GET /api/rates/room-types/:roomTypeId/availability`
- `POST /api/rates/quote`

Protected management:

- `GET /api/rates/manage/room-types/:roomTypeId/plans`
- `POST /api/rates/manage/room-types/:roomTypeId/plans`
- `PUT /api/rates/manage/plans/:ratePlanId`
- `GET /api/rates/manage/plans/:ratePlanId/calendar`
- `PUT /api/rates/manage/plans/:ratePlanId/calendar`
- `DELETE /api/rates/manage/plans/:ratePlanId/calendar`

Admin:

- `GET /api/rates/admin/plans`

## Restrictions

Implemented:

- minimum stay.
- maximum stay.
- closed date.
- closed to arrival.
- closed to departure.
- minimum and maximum advance days.

All restrictions are enforced server-side during quote creation and booking/modification repricing.

## Occupancy

The rate engine reuses `RoomType.maxAdults` and `RoomType.maxChildren`. Rate plans may optionally define stricter occupancy limits, but they do not replace physical room capacity.

## Partner Authorization

Partner management endpoints resolve ownership through:

`req.user -> partner -> hotel -> roomType -> ratePlan`

Partners cannot manage another partner's room types, plans, or calendar rows.

## Admin Authorization

Admins can inspect and manage globally through the same ownership-aware model. Phase 5 adds a global list endpoint but does not introduce multi-hotel partners.

## Frontend

Partner panel now includes `/partner/rates`, a practical rate-plan and date-override interface.

Existing public booking remains compatible. If no explicit rate plan is selected, the default rate plan mirrors the legacy room price.

## Backward Compatibility

Existing room types continue to work through a generated default rate plan using `RoomType.pricePerNight`. No destructive migration is required.

Historical booking money remains stored on the booking and is not recalculated when future rates change.

## Phase 6 Compatibility

The internal model now maps cleanly to future channel-manager concepts:

- hotel.
- room type.
- rate plan.
- rate calendar.
- physical availability.

No provider-specific eZee or OTA fields were added.

## Tests

Focused Phase 5 tests cover:

- rate plan indexes.
- rate calendar indexes.
- input validation.
- default vs calendar override resolution.
- stay restrictions.
- occupancy validation.
- physical availability counting with blocks/bookings.

## Known Limitations

- Public rate-plan selection UI is minimal and remains backward compatible through default plans.
- No OTA/channel-manager sync is implemented.
- No revenue-management automation is implemented.
- No destructive production migration was added.
- Full Atlas regression must still be executed at the final Phase 5 gate when the test environment is available.
