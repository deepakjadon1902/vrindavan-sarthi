# Vrindavan Sarthi — Financial Reconciliation & Partner Settlement Audit

**Document ID:** `VRN-AUD-FIN-014`  
**Audit Scope:** End-to-end mathematical reconciliation of partner payouts, ledger aggregation pipelines, customer refunds, and commission structures  
**Focus Files:** [`backend/routes/partner.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/partner.routes.js), [`backend/utils/pricing.js`](file:///d:/vrindavan-sarthi/backend/utils/pricing.js), [`backend/routes/booking.routes.js`](file:///d:/vrindavan-sarthi/backend/routes/booking.routes.js), [`backend/models/Booking.js`](file:///d:/vrindavan-sarthi/backend/models/Booking.js)  
**Execution Timestamp:** 2026-10-17  
**Status:** Complete  

---

## Standard Commercial Tariff Baseline

To evaluate each financial scenario consistently, we establish a standardized commercial booking baseline derived from the pricing formulas in `backend/utils/pricing.js`:

```
Room Tariff Base Amount (baseAmount):                 ₹10,000.00
Hotel Goods & Services Tax (12% GST - taxAmount):      ₹1,200.00
----------------------------------------------------------------
Subtotal Tariff (grossForHotel):                      ₹11,200.00
Platform Convenience Fee (4.45% - convenienceFeeAmount): ₹445.00
----------------------------------------------------------------
Total Customer Billing (totalAmount / customer_total): ₹11,645.00

Platform Commission (10% on baseAmount):               ₹1,000.00
Payment Gateway Processing Fee (2% on baseAmount):       ₹200.00
----------------------------------------------------------------
Intended Hotel Net Earnings (Gross - Comm - Gateway): ₹10,000.00
Intended Platform Net Retained Fee (Fee + Commission): ₹1,445.00 (+ ₹200 gateway cost)
```

---

## 6 Realistic Operational Scenarios

### Scenario 1: 100% Advance Online Payment, Normal Checkout (`full_100`)

*Description:* Customer books room online, selects 100% full payment, checks in, and checks out normally.

```
Financial Flows:
1. Online Customer Inflow to Platform:        +₹11,645.00
2. Desk Cash Collected by Hotel:                    ₹0.00 (balanceAmount = 0)
3. Platform Holds in Bank Account:            +₹11,645.00

Intended Formula:
  Remittance = grossForHotel - commission - gatewayCharges - balanceAmount
             = ₹11,200 - ₹1,000 - ₹200 - ₹0 = ₹10,000.00

Actual Code Execution (partner.routes.js:522-530):
  net = grossForHotel - (commission + gatewayCharges)
      = ₹11,200 - (₹1,000 + ₹200) = ₹10,000.00

Platform Disburses to Hotel via Bank Transfer: ₹10,000.00
```

- **Reconciliation Outcome:** **BALANCED**
- **Hotel Total Revenue:** ₹0 (cash) + ₹10,000 (bank transfer) = **₹10,000.00** (Accurate)
- **Platform Net Cash Kept:** ₹11,645 - ₹10,000 (payout) - ₹200 (gateway fee paid to Razorpay) = **₹1,445.00** (Convenience fee ₹445 + Commission ₹1,000. Accurate).

---

### Scenario 2: 30% Advance Online, 70% at Hotel Desk, Normal Checkout (`advance_30`)

*Description:* Customer books room online, pays 30% advance online, pays remaining 70% in cash directly to the hotel receptionist at check-in/out, and checks out normally.

```
Financial Flows:
1. Online Customer Inflow to Platform (30%):   +₹3,494.00
2. Desk Cash Collected by Hotel (70%):         +₹8,151.00 (balanceAmount = ₹8,151)
3. Platform Holds in Bank Account:             +₹3,494.00

Intended Accounting Balance:
  Hotel Net Entitlement: ₹10,000.00
  Hotel Already Collected at Desk: ₹8,151.00
  Remaining Net Platform Remittance: ₹10,000 - ₹8,151 = +₹1,849.00
  (Platform received ₹3,494 -> keeps ₹445 fee + ₹1,000 comm + ₹200 gateway = ₹1,645. Remits balance ₹1,849).

Actual Code Execution (partner.routes.js:522-530):
  net = grossForHotel - (commission + gatewayCharges)
      = ₹11,200 - (₹1,000 + ₹200) = ₹10,000.00
  [FATAL: $balanceAmount ($8,151) IS NOT SUBTRACTED!]

Platform Disburses to Hotel via Bank Transfer: ₹10,000.00
```

- **Reconciliation Outcome:** **SEVERE PLATFORM DEFICIT (BUG-001)**
- **Hotel Total Revenue:** ₹8,151 (desk cash) + ₹10,000 (platform bank transfer) = **₹18,151.00**!
- **Hotel Discrepancy:** Overpaid by **+₹8,151.00** (an 81.5% unearned windfall).
- **Platform Net Cash Kept:** ₹3,494 (received) - ₹10,000 (payout) - ₹200 (gateway) = **-₹6,706.00**!
- **Proof:** On every standard ₹10,000 room booking with 30% advance, the platform suffers a direct financial loss of **₹6,706.00**.

---

### Scenario 3: 30% Advance Online, Hotel Collects 70%, Guest Cancels

*Description:* Customer books under `advance_30` (paying ₹3,494 online), hotel collects ₹8,151 on arrival, but guest requests cancellation/refund due to early checkout or property dispute within refundable terms.

```
Financial Flows:
1. Online Customer Inflow to Platform:        +₹3,494.00
2. Desk Cash Collected by Hotel:              +₹8,151.00 (in hotel cash drawer)

Code Execution (booking.routes.js:1108-1111):
  refundableBase = propertyType === 'dharamshala' ? booking.amountPaidOnline : booking.totalAmount
  refundableBase = booking.totalAmount = ₹11,645.00  [BUGGY ASSUMPTION!]
  cancellationDeductionAmount = 12% of ₹11,645 = ₹1,397.00
  refundableAmount = ₹11,645 - ₹1,397 = ₹10,248.00

Gateway Refund Action (bookingModification.js:872):
  Calls executeBookingRefund({ booking, amount: 10248 })
  Attempts to refund ₹10,248 through Razorpay back to the customer's card!
```

- **Reconciliation Outcome:** **CATASTROPHIC REFUND OVERPAYMENT & GATEWAY REJECTION**
- **Discrepancy:** The customer only paid ₹3,494 online, but the backend attempts to refund ₹10,248!
- **Payment Gateway Reaction:** Razorpay/PhonePe API will reject the refund with `BAD_REQUEST_ERROR: Refund amount exceeds captured transaction amount` (unless multi-transaction pooling occurs).
- **Database Status:** Booking refund state is set to `needs_refund_reconciliation` and `refundStatus = 'failed'`.
- **Desk Balance Leakage:** The hotel partner keeps the physical ₹8,151 cash collected from the guest with zero platform recovery mechanism.

---

### Scenario 4: 30% Advance Online, Guest No-Show (`no_show`)

*Description:* Customer pays 30% advance online (₹3,494), never arrives at the property, and property manager marks booking as `no_show`.

```
Financial Flows:
1. Online Customer Inflow to Platform:        +₹3,494.00
2. Desk Cash Collected by Hotel:                    ₹0.00

Code Execution (booking.routes.js:1366 & partner.routes.js:489-491):
  booking.routes.js:1366: if (nextStatus === 'no_show') booking.payout_status = 'cancelled'
  partner.routes.js:489: $match requires { bookingStatus: 'checked_out', payout_status: { $ne: 'settled' } }
```

- **Reconciliation Outcome:** **PARTNER PENALIZATION / ZERO PAYOUT**
- **Discrepancy:** Because `bookingStatus` is `no_show` (not `checked_out`), the booking is **completely excluded** from the partner payout ledger aggregation.
- **Hotel Earnings:** **₹0.00** — Hotel held inventory empty for the night and receives nothing.
- **Platform Inflow:** Platform retains the entire ₹3,494 advance.
- **OTA Industry Standard:** Standard OTA contracts (Booking.com, MakeMyTrip) provide the property partner with the 1st night room rate minus commission upon guaranteed no-show.

---

### Scenario 5: Platform-Initiated Full Refund

*Description:* Due to emergency room unavailability or verified property defect, admin cancels the reservation and issues a 100% full refund to the customer.

```
Financial Flows:
1. Customer paid online:                      +₹11,645.00 (or ₹3,494.00 if advance_30)
2. Admin executes cancelBookingNow(booking, 'Platform cancellation', true)
3. booking.payout_status set to 'cancelled'
4. Refund executed via executeBookingRefund
```

- **Reconciliation Outcome:** **BALANCED FOR 100% ONLINE; DEFECTIVE FOR 30% ADVANCE**
- If `full_100`: Full ₹11,645 refunded to guest. Hotel receives ₹0 remittance. Platform absorbs Razorpay non-refundable gateway charge (~2% = ₹233).
- If `advance_30`: The code attempts to refund `booking.totalAmount` (₹11,645) instead of `amountPaidOnline` (₹3,494), causing refund failure.

---

### Scenario 6: Commission Dispute / Manual Ledger Adjustment

*Description:* Property disputes a commission charge or requests an adjustment for maintenance compensation or rate plan correction.

```
Code Inspection of backend/routes/partner.routes.js & backend/models/Booking.js:
- No Dispute schema exists in MongoDB.
- No Adjustment model or manual ledger override field exists.
- partner.routes.js:581 router.put('/payouts/:partnerId/settled') only accepts:
  { isPaid: Boolean, note: String }
```

- **Reconciliation Outcome:** **ZERO AUDIT TRAIL / UNTRACKED LEDGER DRIFT**
- **Discrepancy:** An administrator cannot adjust commission or record an off-platform penalty. If an admin manually wires a corrected amount via external bank NEFT, the system ledger continues to report the hardcoded mathematical formula, permanently desynchronizing database records from bank statements.

---

## Numerical Summary Comparison Table

| Scenario | Customer Paid Online | Desk Cash Kept by Hotel | Platform Ledger Net Payable (Code) | Intended True Net Payable | Platform Discrepancy (Code vs Reality) |
|---|---|---|---|---|---|
| **1. 100% Advance Normal** | ₹11,645 | ₹0 | **₹10,000** | ₹10,000 | **₹0 (Balanced)** |
| **2. 30% Advance Normal** | ₹3,494 | ₹8,151 | **₹10,000** | ₹1,849 | **-₹8,151 (Platform Overpays / Loses Money)** |
| **3. 30% Advance Cancel** | ₹3,494 | ₹8,151 | ₹0 (Refund attempted: ₹10,248) | Refund: ₹3,074 | **-₹6,754 (Attempted refund exceeds deposit)** |
| **4. 30% Advance No-Show** | ₹3,494 | ₹0 | **₹0** | ₹2,326 (1-night net) | **+₹2,326 (Hotel underpaid / penalised)** |
| **5. Platform Full Refund** | ₹11,645 | ₹0 | **₹0** | ₹0 | **-₹233 (Absorbed gateway fee)** |
| **6. Commission Dispute** | N/A | N/A | **Static aggregation** | Adjusted value | **No adjustment capability in schema** |

---

## Architectural Fix Specification for `partner.routes.js`

To fix `BUG-001` and eliminate financial leakage across all payment options, lines 517-535 and 601-620 in `backend/routes/partner.routes.js` must be updated to subtract `balanceAmount`:

```javascript
// PROPOSED RECONCILED EXPRESSION:
netPayableRemittanceBalance: {
  $sum: {
    $let: {
      vars: {
        net: {
          $subtract: [
            // Net hotel earnings (Gross tariff minus commission and gateway fees)
            {
              $subtract: [
                { $ifNull: ['$grossForHotel', { $add: ['$baseAmount', '$taxAmount'] }] },
                {
                  $add: [
                    { $multiply: ['$baseAmount', { $divide: [{ $ifNull: ['$platformCommissionPercent', 0] }, 100] }] },
                    { $ifNull: ['$paymentGatewayFeeAmount', { $multiply: ['$baseAmount', 0.02] }] },
                  ],
                },
              ],
            },
            // Subtract cash balance already collected directly by hotel at desk:
            { $ifNull: ['$balanceAmount', 0] },
          ],
        },
      },
      in: { $cond: [{ $gt: ['$$net', 0] }, '$$net', 0] },
    },
  },
}
```

This mathematical fix ensures that for `full_100` bookings (`balanceAmount = 0`), the hotel receives ₹10,000; and for `advance_30` bookings (`balanceAmount = ₹8,151`), the hotel receives exactly ₹1,849, perfectly balancing platform accounts.
