# Polar setup, field by field

**This is OPENWORK item 1.** Everything in Part 3 of `OPENWORK.md` waits on it.

**Where this comes from.** Not from memory of Polar's dashboard, which changes. Every
requirement below is derived from the one API call the code actually makes, written out in
`docs/superpowers/plans/2026-08-09-buki-pro.md` under Task 7:

```
POST https://api.polar.sh/v1/license-keys/activate
  Authorization: Bearer <POLAR_ACCESS_TOKEN>
  Content-Type: application/json
  { "key": "<what the customer pastes>",
    "organization_id": "<POLAR_ORGANIZATION_ID>",
    "label": "Buki for Chrome" }
```

and the response it reads:

```json
{ "id": "<activation id>",
  "license_key": { "id": "...", "status": "granted", "expires_at": null } }
```

`api/license.ts` refuses anything whose `license_key.status` is not exactly `granted`.
So the setup has exactly one job: **make that call succeed for a real customer.** Dashboard
labels may read differently from the names below; match them by meaning, and trust the
verification step at the end over any of it.

---

## 1. The organisation

Polar scopes everything to an organisation. You need its **ID**, not its slug.

| Field | Value | Why |
| --- | --- | --- |
| Name | Buki | Shown on the checkout page and the receipt |
| Slug | `buki` | Appears in the checkout URL |

Find the ID under organisation settings, or ask the API:

```
curl -s https://api.polar.sh/v1/organizations \
  -H "Authorization: Bearer <token>" | head -40
```

The `id` is a UUID. **That is `POLAR_ORGANIZATION_ID`.** A slug will not work: the code
sends this value as `organization_id` and Polar matches it as an ID.

---

## 2. The License Key benefit

Create this **first**, because both products attach the same one.

This is the part with fields nobody guesses right, and one of them decides whether the
whole thing functions.

| Field | Set it to | Why this value |
| --- | --- | --- |
| Description | `Buki Pro licence` | Internal label only. Customers never see it. |
| Prefix | `BUKI` | Keys arrive as `BUKI-XXXX-XXXX-…`. Costs nothing and makes a support email instantly identifiable as ours. |
| Expiration / TTL | **Off** | The subscription's own status governs access. A key with its own expiry would cut off a subscriber who is still paying, and the code already re-checks daily. |
| **Activations: enabled** | **YES. Non-negotiable.** | `/license-keys/activate` is only meaningful for a benefit that supports activations. Leave this off and the endpoint the entire paid tier is built on cannot succeed. **If one thing on this page goes wrong, it is this one.** |
| Activation limit | **5** | One per browser profile. Generous for a real person, low enough that a shared key is useless. |
| Allow customer to deactivate | **YES** | Without it, five reinstalls permanently exhaust a paying customer's licence and only you can fix it. With it, they free their own slot. |
| Limit usage | **Leave empty** | That meters consumption per key. Buki meters nothing this way; catches are gated in `entitlement.ts`, on the machine. |

---

## 3. The two products

Two, because Polar models each billing interval as its own product.

| Field | Monthly | Yearly |
| --- | --- | --- |
| Name | `Buki Pro` | `Buki Pro` |
| Description | Hosted cover reading, with no key to go and fetch. Everything else in Buki is free forever, including the shelf. | Same, and two months cheaper than paying monthly. |
| Billing type | Recurring | Recurring |
| Interval | **Month** | **Year** |
| Price | **$4.00 USD** | **$29.00 USD** |
| Benefit attached | **License Key, the one above** | **License Key, the same one** |

> **Attach the benefit to BOTH.** This is written in `OPENWORK.md` as its own warning
> because the failure is silent and expensive: a yearly subscriber pays $29, receives no
> key, and has nothing to paste into the extension. They do not file a bug, they refund.

Anything not listed above can stay at its default. You do **not** need a webhook: the
design validates on demand and stores no subscription state, which is the reason this
project has no database.

---

## 4. The access token

**Create an organisation access token, not a personal one.** A personal token dies with
your account session and takes production with it.

| Field | Value |
| --- | --- |
| Name | `buki-vercel` |
| Scopes | license keys **read and write**, plus organisation read |
| Expiry | The longest offered, and put a reminder in your calendar for a week before |

The write scope is what `/activate` needs: activating a key mutates it by consuming an
activation slot. Read-only will fail, and it will fail at the moment a customer is trying
to use something they just paid for.

**That token is `POLAR_ACCESS_TOKEN`.** It goes in Vercel only. It must never appear in a
file under `src/extension/`, because everything there ships to every user's browser.

---

## 5. Prove it works before writing any code

This is the whole point of doing setup this way round. You can verify the entire chain
with one command, today, before `/api/vision` or `/api/license` exist.

**Get a key to test with.** Either use Polar's sandbox, or create a 100%-off discount code
on the monthly product and buy it yourself. Sandbox is cleaner but note that its API host
is different (`sandbox-api.polar.sh`), and `api/license.ts` hardcodes the production host,
so a sandbox test means temporarily pointing that constant at sandbox while you check.

Then, with a real key in hand:

```bash
curl -i -X POST https://api.polar.sh/v1/license-keys/activate \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"BUKI-XXXX-XXXX-XXXX","organization_id":"<uuid>","label":"curl check"}'
```

**What you are looking for:**

| Result | Meaning |
| --- | --- |
| `200` and `"status": "granted"` | Everything above is correct. Set the Vercel variables and item 1 is done. |
| `403` / `404` on the endpoint | Activations are almost certainly off on the benefit. Go back to section 2. |
| `401` | Token scope, or a personal token that has expired. |
| `422` about `organization_id` | You sent the slug instead of the UUID. |
| `200` but `status` is not `granted` | The subscription is not active: unpaid, cancelled, or refunded. |

Each `curl` consumes one of the five activation slots on that key, so deactivate it
afterwards or use a throwaway key.

---

## 6. Then the five Vercel variables

Project `buki`, all environments. `OPENWORK.md` item 2 lists them; three come from here:

| Name | From |
| --- | --- |
| `POLAR_ACCESS_TOKEN` | section 4 |
| `POLAR_ORGANIZATION_ID` | section 1, the UUID |
| `BUKI_TOKEN_SECRET` | `openssl rand -base64 32`, and nowhere else |
| `GEMINI_API_KEY` | **the paid tier**, see item 2's note about the 12-second hang |
| `BUKI_EXTENSION_ID` | `chrome://extensions` with the extension loaded unpacked |

Nothing reads any of them yet. `/api/vision` is Task 6 and `/api/license` is Task 7, both
of which unblock the moment these exist.
