# Polar setup, field by field

**This is OPENWORK item 1.** Everything in Part 3 of `OPENWORK.md` waits on it.

**Where this comes from.** Not from memory of Polar's dashboard, which changes. The
mechanics are derived from the one API call the code actually makes, and the field names
were checked against Polar's own docs on 2026-08-17. Every price and count is read out of
`src/shared/pricing.ts`, which is the only place this repo lets a number live.

The call, written out in `docs/superpowers/plans/2026-08-09-buki-pro.md` under Task 7:

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
verification step in §7 over any of it.

---

## 1. The organisation

Polar scopes everything to an organisation. You need its **ID**, not its slug.

| Field | Value | Why |
| --- | --- | --- |
| Name | `Buki` | Shown on the checkout page and the receipt |
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
| Expiration | **Off** | The subscription's own status governs access. A key with its own expiry would cut off a subscriber who is still paying, and the code re-checks daily anyway. |
| **Activation limits: enabled** | **YES. Non-negotiable.** | `/license-keys/activate` is only meaningful for a benefit that supports activations. Leave this off and the endpoint the entire paid tier is built on cannot succeed. **If one thing on this page goes wrong, it is this one.** |
| Activation limit | **5** | One per browser profile. Generous for a real person, low enough that a shared key is useless. |
| Enable user to deactivate instances | **YES** | Without it, five reinstalls permanently exhaust a paying customer's licence and only you can fix it. With it, they free their own slot from their purchases page. |
| Usage limit | **Leave empty** | That meters consumption per key and increments on validation. Buki meters nothing this way: catches are counted in `entitlement.ts`, on the machine. Setting it would create a second, invisible limit that disagrees with the first. |

---

## 3. The two products

Two, because Polar locks the billing cycle to the product.

> ### ⛔ Read this before you press create
>
> **Polar locks the pricing type and the billing cycle at creation.** Getting either wrong
> means deleting the product and starting again, and if anybody has already bought it you
> cannot delete it cleanly. Check the interval and the price twice before saving.

| Field | Monthly | Yearly |
| --- | --- | --- |
| **Name** | `Buki Pro` | `Buki Pro Yearly` |
| **Billing cycle** | Recurring | Recurring |
| **Recurring interval** | **Month** | **Year** |
| **Pricing type** | Fixed price | Fixed price |
| **Price** | **$4.00 USD** | **$29.00 USD** |
| **Trial period** | **LEAVE EMPTY** | **LEAVE EMPTY** |
| **Benefit** | License Key, the one from §2 | License Key, **the same one** |
| Description | §3.1 below | §3.1 below, plus the yearly line |
| Metadata | §3.2 | §3.2 |
| Checkout fields | none | none |

**Why the names differ.** Both were `Buki Pro` in the first draft of this document. Two
products with one name are indistinguishable in your own product list, in the metadata you
will read later, and in a refund conversation. The customer sees the interval beside the
price on checkout either way, so the suffix costs the customer nothing and saves you.

> **Attach the benefit to BOTH.** This is written in `OPENWORK.md` as its own warning
> because the failure is silent and expensive: a yearly subscriber pays $29, receives no
> key, and has nothing to paste into the extension. They do not file a bug, they refund.

> **Leave the trial period empty, on both.** Polar's trial is a period of TIME. Buki's
> trial is **ten catches**, counted on the machine by `entitlement.ts` and spent only on
> readings that actually happened. Setting a Polar trial creates a second trial that does
> not know about the first, so somebody gets a fortnight of Pro on top of their ten
> catches, and the wall they eventually meet contradicts the receipt they already have.

Anything not listed above can stay at its default. You do **not** need a webhook: the
design validates on demand and stores no subscription state, which is the reason this
project has no database.

### 3.1 The description

Polar renders this as **Markdown**. Paste it verbatim.

```markdown
Buki catches a book from any picture on the web into a shelf that is yours.

Reading a cover from a photograph is the one thing Buki cannot do on your computer.
**Pro does it for you: no API key to go and fetch, and no limit on how many covers
you read.**

Everything else is free forever, on every plan:

- Your shelf, your piles, and the post you caught each book from
- Books caught from a shop link, or from a post's own words
- Export to Goodreads and StoryGraph

**After you pay you get a licence key.** Open Buki's settings and paste it under
*Your plan*. That is the whole setup, and there is no account to create.

Your shelf never leaves your browser.
```

**On the yearly product, add one line** at the end of the first paragraph:

```markdown
A year for about the price of seven months.
```

> **That line replaced "two months cheaper", which was wrong.** Twelve months at $4 is $48
> and the yearly product is $29, so the saving is **$19, about four and three quarter
> months**, not two. `src/shared/pricing.ts` owns both numbers and
> `pricing.test.ts` asserts that a year beats twelve months; it does not check by how
> much, which is how a wrong comparison survived in this file. **If you change either
> price, recompute this sentence**, because no test can read a Polar dashboard.

**Deliberately not in the description: the price.** Polar prints it beside the description,
and `src/shared/pricing.ts` is the only place this repo lets a price live.

### 3.2 Metadata

Arbitrary key-value pairs. Nothing reads them today; they cost nothing now and are the only
way to answer "which plan did this customer buy" later, because there is no database.

| Key | Monthly | Yearly |
| --- | --- | --- |
| `plan` | `pro-monthly` | `pro-yearly` |
| `surface` | `chrome-extension` | `chrome-extension` |

### 3.3 Checkout fields

**Add none.** They are defined organisation-wide and enabled per product, and every one is
a question between a person and paying you. Polar already collects what billing needs.
Buki has no account, no team, no onboarding survey, and nothing to do with an answer.

---

## 4. The product images

**Two, already generated, at 1200x630 PNG.** Polar accepts multiple images up to 10MB each
and lets you reorder them; put the identity card first.

| Order | File | What it says |
| --- | --- | --- |
| 1 | **`brand/polar-buki-pro-1.png`** (1200x630, 45KB) | The mark, the name, and *"No key to fetch. Buki reads the cover for you."* Its whole job is to confirm you are buying the right thing. |
| 2 | **`brand/polar-buki-pro-2.png`** (1200x630, 90KB) | The real shelf, with real books. What you actually get. |

They live in `brand/` beside the logo source, not in `docs/`, because `docs/` is the public
Vercel root and these are upload assets rather than pages. Both are committed, so the next
person does not have to regenerate them to know what was uploaded.

**They are generated, not prompted, and that was the point.** `marketing-skills:image` is
explicit that AI models hallucinate interfaces, and a made-up picture of "a book app" on
the one page where somebody is about to pay is the worst place for a product that does not
exist. Instead:

- the mark comes from `tools/mark.mjs`, the definition six surfaces are asserted against
- the shelf is `tools/popup-harness.mjs` rendering the real `popup.html` with the real
  `dist/popup.js`, so those are genuine covers drawn by `generatedCover.ts`

**To regenerate** (after any visual change, and before the Web Store screenshots):

```bash
node tools/popup-harness.mjs      # seeds the shelf the second image embeds
node tools/polar-media.mjs        # writes zzz-polar-1.html and zzz-polar-2.html
python -m http.server 8931        # they load the font and the harness by URL
# then screenshot each page at 1200x630
```

The composition is **centred** on purpose: Polar states no fixed aspect for product media,
so a layout you do not control may crop it square. The first version was left-aligned and a
centre crop cut the sentence in half.

**No price is in either image.** A PNG is a surface no test can read, so a price baked into
one is a number that goes stale in silence.

---

## 5. What the customer sees after paying

Polar delivers the key automatically and keeps it on the customer's **purchases page**,
where they can view and copy it, and deactivate an activation if they have used all five.

So the only thing that can go wrong here is that they do not know what to do with it. The
description in §3.1 ends with that instruction for exactly this reason, and the extension
meets them from the other side:

- the wall in the catch tray offers *Get Buki Pro* and, beside it, the free escape hatch
- the setup page opens with **Your plan** and a **Licence key** field, first thing on the
  page, since the 2026-08-17 restructure

**If Polar offers a post-purchase note or a custom success URL**, use:

> Open Buki's settings and paste your licence key under **Your plan**. Nothing else to set
> up, and no account to create.

Check whether that field exists in the dashboard rather than trusting this line: it is the
one item on this page not verified against Polar's docs.

---

## 6. The access token

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

## 7. Prove it works before trusting any of it

You can verify the entire chain with one command, today.

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
| `200` and `"status": "granted"` | Everything above is correct. Set the variables in §8 and item 1 is done. |
| `403` / `404` on the endpoint | Activations are almost certainly off on the benefit. Go back to §2. |
| `401` | Token scope, or a personal token that has expired. |
| `422` about `organization_id` | You sent the slug instead of the UUID. |
| `200` but `status` is not `granted` | The subscription is not active: unpaid, cancelled, or refunded. |

Each `curl` consumes one of the five activation slots on that key, so deactivate it
afterwards or use a throwaway key.

---

## 8. The Vercel variables

Project `buki`, all environments. **`OPENWORK.md` item 2 says five. There are six**; the
sixth was found on 2026-08-17 by reading `api/vision.ts` rather than the list.

| Name | Required? | From |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Yes.** `/api/vision` returns **500** without it | below |
| `BUKI_TOKEN_SECRET` | **Yes.** 500 without it | `openssl rand -base64 32`, and nowhere else |
| `BUKI_EXTENSION_ID` | **Yes.** 500 without it | `chrome://extensions` with the extension loaded unpacked |
| `POLAR_ACCESS_TOKEN` | Yes, for `/api/license` | §6 |
| `POLAR_ORGANIZATION_ID` | Yes, for `/api/license` | §1, the UUID |
| `BUKI_TRIAL_CLOSED` | **No. Leave it unset.** | the brake, below |

**The first three are checked together and fail loudly on purpose.** `visionHandler.ts`
returns 500 if any is missing, because a missing `BUKI_TOKEN_SECRET` would make every
session token verify as garbage and silently demote every paying subscriber to the trial.
A half-configured deploy that looks like it works is the failure mode being avoided.

**`GEMINI_API_KEY`**: create at <https://aistudio.google.com/apikey>, then **link billing**
at <https://aistudio.google.com/plan_information>. The free tier queues rather than
erroring, which is what the 12-second hang on 2026-08-12 actually was, and "it does not
throttle" is a line on their pricing page rather than a behaviour. The key needs access to
the OpenAI-compatible endpoint `api/vision.ts` posts to:

```
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

**No model is pinned anywhere**, deliberately: `visionRoute.ts` sends an empty model and
the server passes the request through, because two pinned models were found retired inside
one afternoon and a pinned default 404s for every new user while working perfectly for the
one person who could notice.

**`BUKI_TRIAL_CLOSED`** is the emergency brake: set it to `1` and the free trial stops
answering, with no deploy. **Leave it unset.** Setting it to anything other than `1` is the
same as unset.

> Until 2026-08-17 this switch was checked before the access decision, so flipping it
> refused **every** request, and a paying subscriber was told *"The free trial is closed
> just now"*. Fixed, with a test that a licensed request still returns 200 while the trial
> is closed. It is safe to use now; it was not when it was undocumented.

---

## 9. The one code change, once checkout URLs exist

Polar gives each product a checkout link. Today the landing's Pro card and the extension
both point at `https://get-buki.vercel.app/#pricing`, and that page's buttons point at
GitHub, which is right for "install it first" and a dead end for somebody who arrived from
the wall with Buki already installed.

**When you have the two URLs, they want exactly one home:** beside the price in
`src/shared/pricing.ts`, next to `PRICING_URL`, with `docs/index.html`'s pricing buttons
reading from it and `pricing.test.ts` extended to assert the landing and the module agree.
That is the same shape as `src/shared/host.ts`, which exists because the production host
was "defined once" and spelled out in seven places.

**Paste the URLs and it is one edit.** Nothing is added before they exist, because a
constant with no caller is the failure `needsRenewal` already cost this project once.
