# Online payments

**Cash / bank / manual entry is the supported, tested path.** Online gateways are optional and **not verified against a live or sandbox gateway** — nobody has run a real transaction through this code.

## How a payment is made safe (all gateways)

1. The parent chooses an invoice; the server **recomputes the amount from the database** (browser sends only the invoice id). A `payment_intents` row is created with a unique reference.
2. The gateway calls back. The server **verifies the signature** with the secret from the environment.
3. The callback is turned into money only by `complete_online_payment(reference, gateway, txn_id, amount)`, which:
   - rejects an unknown reference, a different gateway (`gateway_mismatch`) or a different amount (`amount_mismatch`);
   - is **idempotent** (the same callback twice records one payment);
   - writes every message to `payment_gateway_events` (even failures);
   - allocates the payment to invoices with the same logic as a counter payment.
4. A paid invoice is never downgraded by a later failure callback.

SQL tests cover step 3; unit tests cover the JazzCash signature (`test/services.test.ts`).

## JazzCash — sandbox checklist (do all before going live)

1. Get sandbox merchant credentials from JazzCash; set `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT`, `JAZZCASH_ENDPOINT` (sandbox URL).
2. Register return URL `https://YOUR-APP/api/webhooks/jazzcash`.
3. Make a test payment of a small amount. Confirm: the invoice becomes paid, a receipt exists, `payment_gateway_events` has the callback.
4. **Compare our hash with theirs.** `secureHash()` implements the documented HMAC-SHA256 over the sorted `pp_*` fields with the salt prepended. If JazzCash's field set/ordering differs for your account, the signature check will (safely) reject real callbacks — fix `secureHash` until a genuine sandbox callback verifies.
5. Replay the same callback: expect no second payment.
6. Edit one field in a callback: expect rejection.
7. Test a failed payment, a cancelled payment and an abandoned one.

Until step 3–5 pass, leave the credentials unset (the option is then hidden from parents).

## Easypaisa — disabled on purpose

The Easypaisa callback is not signed in a way we can verify, so a forged request could mark a fee as paid. The code path exists but `enabled()` returns false. To turn it on you need the **transaction-inquiry** call: on every callback, ask Easypaisa's server "is transaction X paid, for amount Y?" and only trust *that* answer. Implement it in `src/lib/payments/easypaisa.ts`, test against their sandbox, then enable.

## Cards
No card gateway is implemented. Do not add card forms that post card numbers to this server; use a hosted payment page from your gateway.
