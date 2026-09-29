# Payment gateway sandbox test guide

Har gateway ko **ek ek karke** test karo. Koi bhi gateway tab tak live mat karo
jab tak neeche wali checklist poori na ho. Gateway sirf tab checkout par nazar
aata hai jab uske Cloudflare variables set hon.

> **Sach:** code-complete hai, lekin parameter names aur hash format abhi
> provider ke apne integration document se confirm nahi hue. Sandbox test
> ka maqsad yehi confirm karna hai. Test pass hone se pehle "verified" mat kaho.

## Pehle se zaroori

1. Worker deploy ho chuka ho aur site khulti ho (`https://<name>.workers.dev`).
2. Cloudflare → Workers & Pages → apna worker → Settings → Variables and Secrets.
3. Logs dekhne ke liye: worker → **Logs** (Observability). Callback fail ho to
   yahan error milega.
4. Supabase → SQL Editor mein ye query yaad rakho (har test ke baad chalao):

```sql
select created_at, gateway, txn_ref, amount, signature_valid, raw
from payment_transactions order by created_at desc limit 10;
```

Order ka haal:

```sql
select o.order_number, o.status, o.payment_state, p.state, p.gateway, p.amount
from orders o join payments p on p.order_id = o.id
order by o.created_at desc limit 5;
```

---

## 1. JazzCash (pehle isse karo)

**Sandbox account:** JazzCash merchant sandbox portal se lo. Wahan se
Merchant ID, Password aur Integrity Salt milte hain.

**Cloudflare variables**

| Name | Type | Value |
|---|---|---|
| `JAZZCASH_MERCHANT_ID` | Plain | portal se |
| `JAZZCASH_PASSWORD` | Secret | portal se |
| `JAZZCASH_SALT` | Secret | Integrity Salt |
| `JAZZCASH_ENV` | Plain | `sandbox` |

**Return URL:** JazzCash portal mein return URL yeh daalo (agar portal maange):
`https://<tumhari-site>/api/payments/jazzcash/callback`

**Test steps**

1. Site par koi product cart mein daalo, checkout kholo.
2. Payment method mein **JazzCash** nazar aana chahiye. Nahi aaye to variables
   ya redeploy check karo.
3. Order place karo. Browser JazzCash sandbox page par jana chahiye.
4. Sandbox ka test wallet number / MPIN portal ke docs se use karo.
5. Payment complete karo. Site par wapas aa kar "payment successful" page aana chahiye.

**Kya pass hona chahiye**

- [ ] Redirect JazzCash sandbox page par gaya (koi "invalid hash" ya "invalid parameter" error nahi).
- [ ] `payment_transactions` mein nayi row, `signature_valid = true`.
- [ ] `orders.payment_state = paid` aur `status = confirmed`.
- [ ] Amount sahi hai (Rs 2,050 order = `pp_Amount` 205000 paisa).
- [ ] Failed payment (galat MPIN ya cancel) par order `paid` **nahi** hua.
- [ ] Wahi callback dobara bhejne par kuch downgrade nahi hua.

**Common masle**

- *"Invalid Secure Hash"* → Salt galat hai ya hash ka field order mismatch. Provider doc ka hash-ka-tareeqa `jcHash()` (`src/payments.js`) se compare karo, aur mujhe bhejo.
- *Callback aaya lekin order unpaid* → `payment_transactions` ki `raw` column dekho: `pp_ResponseCode` kya tha? (`000` = success.)
- *`bad_signature`* → Salt galat ya provider ne extra field bheji.

---

## 2. Easypaisa

> **Easypaisa "manual confirm" mode mein hai.** Postback signed nahi hota, isliye
> code kabhi order ko khud "paid" nahi karta. Success postback sirf **pending**
> banata hai. Aap Easypaisa merchant portal mein payment dekhte hain, phir admin →
> Orders → order kholo → **Mark paid** dabate hain (portal ka Transaction ID daalna
> zaroori hai). Isse fake callback se order paid nahi ho sakta.
> Automatic karna ho to Easypaisa ki transaction-inquiry API lagani hogi.

**Cloudflare variables**

| Name | Type | Value |
|---|---|---|
| `EASYPAISA_STORE_ID` | Plain | Telenor Bank se |
| `EASYPAISA_HASH_KEY` | Secret | Telenor Bank se |
| `EASYPAISA_ENV` | Plain | `sandbox` |

**Note:** kuch Easypaisa accounts AES-128-ECB signed request maangte hain, jo
Workers mein available nahi. Telenor Bank se un-hashed hosted checkout enable
karwana pad sakta hai.

**Postback URL:** `https://<tumhari-site>/api/payments/easypaisa/callback`

**Test steps:** JazzCash jaise hi (checkout → Easypaisa → sandbox page → payment).

**Pass checklist**

- [ ] Sandbox page khula (`easypaystg.easypaisa.com.pk`).
- [ ] Successful payment par order **pending** rahe (paid nahi) aur customer ko "payment pending" page dikhe.
- [ ] Admin mein **Mark paid** dabane (Transaction ID ke saath) par `payment_state = paid`, `status = confirmed`, aur `payment_transactions` mein `event = manual` row.
- [ ] Failed / cancelled payment par `paid` nahi hua.
- [ ] `payment_transactions` mein raw postback aayi.
- [ ] Callback ke field names (`status`, `orderRefNumber`, `transactionAmount`) asli postback se match karte hain (raw column dekho).
- [ ] Fake callback (sirf reference + amount) order ko paid nahi karta, sirf pending.

---

## 3. Card / generic PSP (Safepay, PayFast, Alfa waghera)

Ye gateway variables se chalta hai. Provider ka signature format
`sortedHmac()` jaisa hona chahiye (sorted `key=value` join `&`, HMAC-SHA256).
Agar tumhare provider ka format alag hai to code badalna padega.

**Cloudflare variables**

| Name | Type | Value |
|---|---|---|
| `CARD_CHECKOUT_URL` | Plain | provider ka sandbox hosted-page URL |
| `CARD_MERCHANT_ID` | Plain | provider se |
| `CARD_SECRET` | Secret | provider se |
| `CARD_FIELD_MAP` | Plain, optional | JSON jo field names rename kare |

**Callback URL:** `https://<tumhari-site>/api/payments/card/callback`

**Pass checklist**

- [ ] Provider ke sandbox card number se payment hui.
- [ ] `signature_valid = true` aur order `paid`.
- [ ] Galat card / decline par order `paid` nahi hua.
- [ ] Provider ka signature format `sortedHmac()` se match karta hai. Nahi karta to provider doc mujhe bhejo.

---

## Sab gateways ke liye common security checks

Ye tests sandbox ke baad bhi karo:

- [ ] Order ka amount browser se change karke bhejo. Server ko apni hi price use karni chahiye (`create_order`).
- [ ] Kisi aur order ka reference callback mein daal kar bhejo. `amount_mismatch` ya `unknown_reference` aana chahiye.
- [ ] Paid order par "failed" callback bhejo. Order `paid` hi rehna chahiye (replay guard).
- [ ] Koi secret (`JAZZCASH_SALT`, `CARD_SECRET`, service-role key) page source ya browser network tab mein nazar na aaye.

## Live jane se pehle

- [ ] Har gateway ke upar wali checklist poori.
- [ ] Easypaisa: har payment portal mein dekh kar hi Mark paid karna (manual confirm).
- [ ] `*_ENV` ko `live` karo aur **live credentials alag** se daalo (sandbox wale nahi).
- [ ] Ek chhota real order (Rs 100–200) khud karo aur refund karwa ke dekho.
- [ ] Provider ke live portal mein return/callback URL live domain par set ho.

## Jab kuch fail ho, mujhe ye bhejo

1. Kaunsa gateway, kaunsa step.
2. Cloudflare logs ka text ya screenshot.
3. `payment_transactions` ki latest row (`raw` column samet). **Secret ya password mat bhejna.**
4. Provider ka integration document (PDF ya link).
