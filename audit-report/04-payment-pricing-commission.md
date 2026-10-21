# Vrindavan Sarthi — Pricing, Commission, Payment & Settlement Audit

**Document ID:** `VRS-AUDIT-04-PAYMENT-PRICING`  
**Audit Date:** October 17, 2026  
**Auditor:** Senior Software Architect, Financial Systems & OTA Settlement Auditor  

---

## 1. Verified Pricing & Commission Business Rules

The commercial logic is implemented in `backend/utils/pricing.js`, `backend/utils/rateEngine.js`, and `backend/routes/partner.routes.js`.

### Core Financial Constants:
- `PARTNER_COMMISSION_PERCENT = 10` (10% platform commission on hotel room tariff)
- `DHARAMSHALA_PLATFORM_FEE_PERCENT = 10` (or fixed service fee, default ₹79 - ₹99)
- `CONVENIENCE_FEE_PERCENT = 4.45` (4.45% platform convenience fee charged to customer)
- `GATEWAY_FEE_PERCENT = 2.0` (2% payment gateway processing charge)
- `GST_THRESHOLD_AMOUNT = 7500`
- `LOW_GST_PERCENT = 5` (for room rate $\le$ ₹7,500/night)
- `HIGH_GST_PERCENT = 18` (for room rate $>$ ₹7,500/night)
- `HOTEL_DEFAULT_TAX_PERCENT = 12` (standard fallback when manual GST mode is set)
- `CANCELLATION_DEDUCTION_PERCENT = 12` (12% retention on customer cancellations)

---

## 2. Pricing & Taxation Architecture by Property Category

### Category A: Commercial Hotels (`propertyType: 'hotel' | 'guest_house' | 'home_stay'`)
1. **Room Base Amount (`roomAmount`):** $\text{Price Per Night} \times \text{Nights} \times \text{Room Quantity}$.
2. **Hotel GST (`hotel_gst_amount`):**
   - If `hotel.taxEnabled == false`: GST = ₹0.
   - If `hotel.taxEnabled == true` and `gstMode == 'automatic'`:
     - If price per night $\le$ ₹7,500: GST = 5%.
     - If price per night $>$ ₹7,500: GST = 18%.
   - If `gstMode == 'manual'`: GST = `hotel.taxPercent` (or settings default, 12%).
3. **Convenience Fee (`convenience_fee`):**
   - Charged to the customer: $4.45\%$ of `roomAmount`.
4. **Customer Total (`customer_total`):**
   $$\text{Total Amount} = \text{roomAmount} + \text{hotel\_gst\_amount} + \text{convenience\_fee}$$
5. **Customer Payment Options:**
   - `advance_30`: Customer pays 30% of Total Amount online; remaining 70% paid directly to the hotel desk at check-in.
   - `full_100`: Customer pays 100% of Total Amount online upfront.

---

### Category B: Dharamshalas (`propertyType: 'dharamshala'`)
1. **Dharamshala Contribution Amount (`dharamshalaAmount`):** Room stay contribution.
2. **Taxes / GST:** **₹0** (exempt from commercial lodging GST).
3. **Platform Commission:** **0%** (Vrindavan Sarthi charges ₹0 commission to Dharamshala trusts).
4. **Platform Fee (`vrindavanSarthiServiceFee`):**
   - Default ₹79 to ₹99 fixed fee, or 10% platform convenience fee paid by the pilgrim online.
5. **Payment Modes for Dharamshala:**
   - `pay_at_dharamshala`: Pilgrim pays only the platform fee (e.g. ₹99) online; full stay contribution paid directly at the Dharamshala office upon arrival.
   - `full_online`: Pilgrim pays entire amount (stay contribution + platform fee) online.

---

## 3. Critical Financial Settlement Flaw in Partner Payouts

### Location: `backend/routes/partner.routes.js:517-536` & `partner.routes.js:601-620`

```javascript
// partner.routes.js:517-536 (Aggregator for Partner Remittance)
netPayableRemittanceBalance: {
  $sum: {
    $let: {
      vars: {
        net: {
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
      },
      in: { $cond: [{ $gt: ['$$net', 0] }, '$$net', 0] },
    },
  },
}
```

### The Flaw Explained:
- When a booking uses the default `advance_30` option:
  - The customer pays **30%** online to Vrindavan Sarthi.
  - The hotel collects **70%** directly from the guest in cash at the hotel reception.
- The formula in `partner.routes.js` calculates what the platform owes the hotel as:
  $$\text{Remittance} = \text{grossForHotel} - \text{commission} - \text{gatewayFee}$$
- It **fails to subtract `balanceAtProperty` (the 70% cash already in the hotel's hands)**!

---

## 4. Worked Numerical Comparison (Synthetic Data)

Let us trace a standard 1-night hotel room booking with:
- **Base Room Price:** ₹1,200
- **GST Rate:** 12% (₹144)
- **Convenience Fee (4.45%):** ₹53
- **Platform Commission (10%):** ₹120
- **Gateway Fee (2%):** ₹24
- **Customer Total:** ₹1,397

### Scenario A: Full Online Payment (`full_100`)
| Metric | Platform Account | Hotel Account | Total / Verification |
| :--- | :--- | :--- | :--- |
| Customer Paid Online | +₹1,397 | ₹0 | ₹1,397 collected by platform |
| Platform Retains: Commission | +₹120 | - | Platform revenue |
| Platform Retains: Convenience Fee | +₹53 | - | Platform revenue |
| Payment Gateway Deducted (2%) | -₹24 | - | Paid to Razorpay |
| Hotel Net Due (`gross - comm - gw`) | -₹1,200 | +₹1,200 | (₹1,344 gross - ₹120 comm - ₹24 gw = ₹1,200) |
| Platform Net Remittance to Hotel | **₹1,200** | **₹1,200** | **BALANCED ✅** |

### Scenario B: 30% Advance Payment (`advance_30`)
- Customer pays 30% online: **₹419**
- Customer pays 70% at hotel desk in cash: **₹978**

| Metric | Correct Accounting | Current Buggy Code in `partner.routes.js` | Discrepancy / Risk |
| :--- | :--- | :--- | :--- |
| Money in Platform Bank | +₹419 | +₹419 | Only 30% collected online |
| Money in Hotel Cash Drawer | +₹978 | +₹978 | 70% cash collected directly from guest |
| Platform Commission (10% of base) | ₹120 | ₹120 | Due to platform |
| Convenience Fee (retained by platform) | ₹53 | ₹53 | Due to platform |
| Gateway Fee (Razorpay cost) | ₹24 | ₹24 | Due to Razorpay |
| **Net Platform Remittance Owed to Hotel** | **₹222**<br/>($419 - 120 - 53 - 24$) | **₹1,200**<br/>($1344 - 120 - 24$) | **BUG: Platform overpays by ₹978!** |
| Platform Cash Flow | +₹0 (retains ₹173 fee) | **-₹781 (Severe Deficit)** | **Platform pays out money it never received!** |
| Hotel Total Realization | **₹1,200**<br/>(₹978 cash + ₹222 bank) | **₹2,178**<br/>(₹978 cash + ₹1,200 bank) | **Hotel gets 181% of agreed tariff!** |

> [!CAUTION]
> **P0 CRITICAL FINANCIAL LEAKAGE RISK:**  
> The payout settlement query in `backend/routes/partner.routes.js` MUST subtract `$balanceAmount` (the balance collected at the property) from `grossForHotel` before remitting funds to the hotel partner.

---

## 5. Payment Gateway Implementation & Webhook Inbox

1. **Order Creation (`POST /api/payments/razorpay/orders`):**  
   - Calculates payable amount server-side via `payableAmountForBooking(booking)`.
   - Never trusts client-submitted amounts.
   - Enforces INR currency and passes booking code in order receipt.
2. **Signature Verification (`POST /api/payments/razorpay/verify`):**  
   - Computes HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
   - Fetches payment details from Razorpay API (`/v1/payments/:id`).
   - Ensures `payment.amount == expectedPaise` and captures payment if in `authorized` state.
   - Rejects mismatched orders or signatures.
3. **Webhook Inbox (`POST /api/payments/razorpay/webhook`):**  
   - Verifies `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET`.
   - Inserts raw body into MongoDB collection `WebhookEvent` with unique compound index (`provider + eventId`).
   - If Redis is active, enqueues BullMQ job; if Redis is unavailable, synchronously processes inbox record.
   - Handles duplicate event delivery idempotently without double-marking bookings.

---

## 6. Client-Side Price Tampering Assessment

| Attack Vector | Client Payload | Backend Check | Security Verdict |
| :--- | :--- | :--- | :--- |
| **Manipulate Room Base Price** | `{"pricePerNight": 100}` | `createBookingQuote` fetches `roomType.pricePerNight` from DB | **SAFE / BLOCKED** |
| **Manipulate Tax Percent** | `{"taxPercent": 0}` | `getHotelTaxPercent` fetches hotel tax rules from DB | **SAFE / BLOCKED** |
| **Manipulate Convenience Fee** | `{"convenienceFeeAmount": 0}` | `buildMoneyFields` computes 4.45% or 10% server-side | **SAFE / BLOCKED** |
| **Manipulate Razorpay Order Amount** | `{"amount": 100}` | `payableAmountForBooking` computes expected paise | **SAFE / BLOCKED** |
| **Manipulate Payment Signature** | Fake signature | Crypto HMAC comparison with secret | **SAFE / BLOCKED** |

---

## 7. Unresolved Commercial Business Questions

1. **GST Handling on Commission:** Does Vrindavan Sarthi charge 18% GST on its 10% platform commission, or is the 10% commission inclusive of GST?
2. **Payment Gateway Fee Burden:** Should the 2% Razorpay fee be absorbed by the platform, deducted from the partner's payout (current code), or passed on to the customer?
3. **Dharamshala Fixed Fee Consistency:** The codebase contains references to both ₹79 (in `dharamshalaLifecycle.js`) and ₹99 (in live production hotel records for `Shri Giriraj Sewa Sadan`). The owner must decide the standard fixed service fee.
