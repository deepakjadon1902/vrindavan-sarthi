# VRINDAVAN SARTHI
## Platform Owner — Financial & Commercial Policy Approval Register

**Document Type:** Formal Owner Decision & Sign-off  
**Project:** Vrindavan Sarthi OTA  
**Decision Reference:** DEC-01 to DEC-04  
**Document Status:** Pending Platform Owner Review  
**Effective Date:** To be determined after approval  

---

## 1. Purpose

This document records the Platform Owner's formal decisions regarding the financial and commercial policies implemented or proposed in Vrindavan Sarthi.

Each decision must be individually approved, rejected, or returned for modification.

Approval of software implementation does not automatically constitute approval of the underlying commercial policy.

---

## 2. DEC-01 — Option B Retained Advance Allocation Model

**Proposed decision:** APPROVE / REJECT / MODIFY

### Proposed policy

When a customer voluntarily cancels an eligible booking made with a 30% online advance:

1. The actual online advance received is treated as the maximum available amount for allocation.
2. The platform's standard commission is calculated on the eligible full hotel tariff.
3. The platform's commission collection from retained room advance is capped at the available room-advance portion.
4. The remaining retained room-advance amount is attributable to the partner.
5. The platform must not create a negative partner balance or pay more than the retained funds available.
6. Any uncollected desk balance is excluded from the calculation.
7. Convenience fee is accounted for separately from room advance.

### Financial calculation

- `A_total = A_room + CF`
- `C_actual = min(C_contract, A_room)`
- `E_partner = A_room - C_actual`
- `R_platform = C_actual + CF`

Where:

- `A_total` = Actual online advance received
- `A_room` = Room-related advance portion
- `CF` = Convenience fee
- `C_contract` = Contractual commission amount
- `C_actual` = Commission actually allocated from retained room advance
- `E_partner` = Partner entitlement
- `R_platform` = Platform allocation, subject to the separately approved convenience-fee policy

**Important:** This approval does not independently settle tax treatment, accounting recognition, or the legal characterization of retained amounts. CA review remains necessary.

### Owner decision

- [ ] APPROVED
- [ ] REJECTED
- [ ] MODIFICATIONS REQUIRED

**Owner comments:** __________________________________

---

## 3. DEC-02 — Commission Shortfall Waiver

**Proposed decision:** APPROVE / REJECT / MODIFY

### Proposed policy

If the contractual commission exceeds the room-advance amount available for allocation:

1. Commission collection is capped at the available room-advance amount.
2. The uncollected commission shortfall is waived.
3. No partner debt, negative balance, or automatic receivable is created.
4. No amount may be allocated beyond the actual retained funds.

**Example:**

- Contractual commission: ₹2,000
- Available room advance: ₹1,380
- Commission collected: ₹1,380
- Commission shortfall waived: ₹620
- Partner entitlement: ₹0

This is a proposed commercial waiver policy, not merely a technical calculation.

### Owner decision

- [ ] APPROVED
- [ ] REJECTED
- [ ] MODIFICATIONS REQUIRED

**Owner comments:** __________________________________

---

## 4. DEC-03 — Convenience Fee Retention and Refund Policy

**Proposed decision:** APPROVE / REJECT / MODIFY

### Proposed policy

**A. Voluntary customer cancellation**

- 100% of the convenience fee is retained by the platform, subject to applicable law and CA advice.
- Room advance is allocated separately under the approved cancellation and financial policies.

**B. Hotel/property failure**

- 100% of the actual online amount paid by the customer is refunded.
- This includes the convenience fee.
- Gateway charges already incurred are absorbed by the platform.

**C. Platform/system failure**

- 100% of the actual online amount paid by the customer is refunded.
- Uncollected desk balance is not included in the refund.
- Gateway charges already incurred are absorbed by the platform.

**Important:** The commercial policy requires CA/legal review before being treated as an approved customer-facing contractual term.

### Owner decision

- [ ] APPROVED
- [ ] REJECTED
- [ ] MODIFICATIONS REQUIRED

**Owner comments:** __________________________________

---

## 5. DEC-04 — Payment Gateway Processing Fee Absorption

**Proposed decision:** APPROVE / REJECT / MODIFY

### Proposed policy

1. Payment gateway processing charges are borne by the platform.
2. No additional gateway surcharge is passed to customers at checkout.
3. Gateway charges are recorded separately from hotel tariff, commission, and convenience fee.
4. Refund-related gateway costs are handled according to the approved refund policy.
5. Actual gateway settlement and fee statements must be reconciled with platform financial records.

### Owner decision

- [ ] APPROVED
- [ ] REJECTED
- [ ] MODIFICATIONS REQUIRED

**Owner comments:** __________________________________

---

## 6. Approval Summary

| Decision | Subject | Owner Status |
|---|---|---|
| DEC-01 | Option B retained advance allocation | Pending |
| DEC-02 | Commission shortfall waiver | Pending |
| DEC-03 | Convenience fee retention/refund | Pending |
| DEC-04 | Gateway processing fee absorption | Pending |

---

## 7. Owner Declaration

I have reviewed the above financial and commercial proposals. I understand their intended operational and financial consequences and have recorded my decision for each item.

I understand that:

- Approval of a commercial policy is separate from software testing.
- Applicable GST, TDS, TCS, invoicing, and accounting treatment must be reviewed by a practicing Chartered Accountant.
- No production deployment or live financial operation is authorized merely by signing this document.
- Any approved policy must be reflected in the official decision register and communicated through the appropriate customer and partner terms.

**Platform Owner Name:** __________________________

**Signature:** ___________________________________

**Date:** ________________________________________

**Place:** _______________________________________

---

## 8. Post-Approval Governance

After the owner records the decisions:

1. Update `docs/FINANCIAL_GOVERNANCE_DECISION_REGISTER.md`.
2. Record the approval date, decision, and any conditions.
3. Obtain CA's written opinion on applicable tax and accounting treatment.
4. Update the Production Readiness Gap Matrix.
5. Keep unapproved decisions gated.
6. Do not change production configuration or deploy without separate authorization.
