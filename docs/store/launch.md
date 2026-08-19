# Launch: the order, the gates, and what to watch

**Written 2026-08-18.** Not served publicly: `docs/store` is in `.vercelignore`.

> **This file owns the SEQUENCE. It does not own status.**
>
> What is open and who owns it lives in `OPENWORK.md` → THE LANE, and nowhere else.
> Every step below points at an item number rather than restating it, because
> `OPENWORK.md` §0 records what happens when one fact lives in two files: they disagree,
> and the one you read is the stale one.
>
> The copy that goes in each dashboard field is `docs/store/listing.md`. The permission
> answers are `docs/store/permissions.md`. Neither is repeated here.

---

## What is actually true today

| | |
| --- | --- |
| Code | Complete. **Run the probe rather than trusting this line** — `./node_modules/.bin/vitest run`, `node node_modules/typescript/bin/tsc --noEmit`, `node build.mjs`. It read 597/57 green when this was written, and `OPENWORK.md`'s header records how many times a count in a document has drifted |
| Paid tier | Written, tested, **switched off** and **unbuyable** (items 2, 34) |
| Store documents | Written and clean. No DO-NOT-SUBMIT banners left in `permissions.md` |
| Screenshots | **Zero** (item 9) |
| Users | Zero. Pre-launch. The founder is the only documented user |
| Revenue | Checkout is wired (item 34, done 2026-08-18). **Still $0 until the affiliate tags are pasted** (item 35) and until anybody can install it |

**Nothing in the code blocks launch.** Everything below needs a dashboard, a credential,
a browser or a camera.

---

## THE ORDER

Each step is blocked by the one above it. The numbers are `OPENWORK.md` items.

| # | Step | Owner | Blocked until |
| --- | --- | --- | --- |
| 1 | Polar: verify the benefit's activation settings, on **both** products | Maximo | — |
| 2 | Gemini key **with billing linked**, and the spend cap in the same sitting (26) | Maximo | — |
| 3 | **Register the developer account, pay the one-time fee** | Maximo | — (do it first, it now gates more than submission) |
| 4 | **Zip and upload as a DRAFT. Do not publish.** Copy the public key into `manifest.json` as `key` (item 37) | Maximo, then agent | step 3 |
| 5 | The six Vercel variables (item 2) — `BUKI_EXTENSION_ID` is now the SHIPPED id | Maximo | steps 1, 2, 4 |
| 6 | `vercel deploy --prod`, then probe both endpoints | Maximo | step 5 |
| ~~7~~ | ~~The checkout URLs → `pricing.ts` (item 34)~~ **DONE 2026-08-18** | — | — |
| 8 | The affiliate tags (item 35) | Maximo | — (parallel) |
| 9 | The by-hand browser pass, thirteen checks (item 3) | **Maximo only** | steps 4, 6 |
| 10 | Five screenshots at 1280x800 (item 9) | Maximo | step 9 |
| 11 | Publish the draft | Maximo | steps 9, 10 |
| 12 | Wait. Days to weeks | — | step 11 |
| 13 | **Switch the landing's five install CTAs to the store URL (item 36)** | agent | step 12 |
| 14 | Launch day | both | step 13 |

> **WHY STEP 4 MOVED, and it is the third "inert on day one" blocker this project has
> found.** `BUKI_EXTENSION_ID` is what both endpoints check `Origin` against, and Chrome
> derives an extension's id from **a hash of its public key**. Unpacked, Chrome invents that
> key locally; published, the Web Store signs with a different one. So the id from
> `chrome://extensions` during the by-hand pass is **not the id your customers get**, and
> both endpoints would 403 for everybody on the day it went live.
>
> Uploading a draft first assigns the real id and exposes the public key. Pinning it in
> `manifest.json` makes the unpacked build load under the shipped id, so item 3 tests the
> thing that ships. Item 37.

**Steps 1, 2, 3 and 8 have no blockers and can be done today.** Everything else is a chain,
and step 3 now sits near the front rather than beside submission.

---

## Step by step, with the check that proves it

### 1. Polar

The products exist. **One field decides whether the entire paid tier functions**, and the
failure is silent: on the License Key benefit, `Activation limits: enabled` must be **YES**,
limit **5**, `Enable user to deactivate instances` **YES**, `Usage limit` **empty**,
`Expiration` **off**. The same benefit must be attached to **both** products, or a yearly
subscriber pays $29, gets nothing to paste, and refunds rather than filing a bug.

**Prove it rather than reading the dashboard** (`polar-setup.md` §7). With a key from a
100%-off discount code on the monthly product:

```bash
curl -i -X POST https://api.polar.sh/v1/license-keys/activate \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"BUKI-XXXX-XXXX-XXXX","organization_id":"<uuid>","label":"curl check"}'
```

`200` + `"status": "granted"` and step 1 is done. `403`/`404` means activations are off.
`422` on `organization_id` means you sent the slug. **Each run spends one of that key's five
slots**, so use a throwaway key or deactivate afterwards.

### 2. Gemini, with billing, and the cap in the same sitting

Billing is not about capacity, it is about a sentence you have already published. The Pro
card says *"Faster, and it does not throttle."* The free tier **queues rather than
erroring** — that is what the 12-second hang on 2026-08-12 was. Shipping Pro on the free
tier makes your own pricing page false.

**Set the spend cap before you leave the page** (item 26). Both endpoints identify the
caller by an `Origin` header that anything non-browser can set, and the extension id is
public the moment the item is listed. Everything in the code raises the bar; the provider
cap is the floor. There is no other control that bounds real money.

**While you are there, check what a catch actually costs.** `policy.ts` rests the whole
trial threat model on *"about $0.00011"*, a figure that appears exactly once in this repo,
in the comment that uses it. Never measured.

### 3. The six variables

**THE PROJECT IS CALLED `shelfy`, NOT `buki`.** Checked on 2026-08-18: the project serving
`get-buki.vercel.app` still carries its old name, and there is a separate
`save-book-extension` project on the same account that looks exactly like the right answer
and is not. `vercel env ls` currently returns **no environment variables at all**, so all
six are outstanding.

`polar-setup.md` §8, and `OPENWORK.md` item 2. **All environments.**
**None may ever appear in a file under `src/extension/`** — that is a leak, not a shortcut.
`BUKI_TRIAL_CLOSED` stays unset.

The first three (`GEMINI_API_KEY`, `BUKI_TOKEN_SECRET`, `BUKI_EXTENSION_ID`) are checked
together and return **500** if any is missing, deliberately: a missing token secret would
verify every session token as garbage and silently demote every subscriber to the trial. A
half-configured deploy that looks like it works is the failure being avoided.

### 4. Deploy, then probe

```bash
vercel deploy --prod
```

Then check the two things that have never run against a real network:

```bash
# Should be 403 (not 500). 500 means a variable is missing.
curl -i -X POST https://get-buki.vercel.app/api/vision -d '{}'

# Should be 403 without the Origin header, 400 with it and no key.
curl -i -X POST https://get-buki.vercel.app/api/license -d '{}'
curl -i -X POST https://get-buki.vercel.app/api/license \
  -H "Origin: chrome-extension://<your-extension-id>" \
  -H "Content-Type: application/json" -d '{}'
```

**A 500 from either means step 3 is incomplete.** That is the whole reason they 500 loudly.

### 4 and 5. The draft upload, then the variables

**Do the draft upload before you set `BUKI_EXTENSION_ID`.** Item 37, and the reason is in
the banner above: the id you see in `chrome://extensions` for an unpacked build is not the
id the Web Store will assign, and `policy.ts` compares the `Origin` header against exactly
that string.

```
1. zip the extension directory
2. Developer Dashboard -> Add new item -> upload -> DO NOT PUBLISH
3. Package tab -> View public key
4. copy between BEGIN/END PUBLIC KEY, strip the newlines
5. manifest.json:  "key": "<that one line>"
6. reload unpacked -> chrome://extensions now shows the SHIPPED id
```

Only then set the variables. `polar-setup.md` §8 has the six with their sources.

**The checkout URLs that used to be this step are done** (item 34, 2026-08-18):
`CHECKOUT_MONTHLY_URL` and `CHECKOUT_YEARLY_URL` live in `src/shared/pricing.ts` and the Pro
card carries both, inside `#pricing`, which is where every purchase CTA in the extension
lands.

### 6. The affiliate tags

`OPENWORK.md` item 35. `AFFILIATE = { amazonTag: '', bookshopId: '' }` in `buyLink.ts`.
Every Buy link works and earns nothing. The disclosure half is already done in three places
because store policy requires it. **One paste, no blockers, do it whenever.**

### 7. The by-hand pass — thirteen checks, and no agent can ever do it

`OPENWORK.md` item 3, written out under Task 11 in the plan. Chrome stable refuses
`--load-extension` and `--disable-extensions-except`, so there is no headless substitute.

**Two of the checks now cover things that have never run anywhere.** Both blockers found on
2026-08-18 were of the same kind — written, tested, and inert — and both would surface only
here:

- **Catch on a keyless profile.** Proves the manifest's new host permission actually lets
  the worker reach `/api/vision`. Until `b4118cf` it could not have.
- **Paste a licence, then use Buki tomorrow.** Proves `readPro` carries the activation id
  back out of storage. Until `3012b30` it did not, and the wall would have returned on day
  five with nothing red anywhere.

**The unpacked build is a valid instrument here, but only AFTER item 37.** Pinning `key` in
`manifest.json` makes Chrome derive the same id for the unpacked build that the Web Store
will derive for the signed one - that is the whole point of the item. Run this pass before
the key is in and you are exercising an id no customer will ever have, against a `policy.ts`
that compares `Origin` to exactly that string.

**What the unpacked pass still cannot see is the signed package over the real install
path.** Publishing at **Private** visibility first, with yourself as a trusted tester, would
cover that: a real store install of the real artefact. It is optional, and it is NOT what
item 37 needs.

> **UNVERIFIED: whether a Private-visibility publish requires its own review cycle.** If it
> does, this costs days-to-weeks twice and is not worth it before a first launch. Check in
> the dashboard before choosing it; do not assume either way on the strength of this note.

### 8. Screenshots

`OPENWORK.md` item 9. Five at 1280x800. The shot list is in `listing.md` and the order
matters: the shelf leads because it is the one that sells it.

**Shoot against a shelf holding books you actually saved.** A mocked shelf reads as a mock,
and this is a product whose entire claim is that the list is yours.

### 3. The developer account — do this FIRST, not last

You must register as a Chrome Web Store developer and pay a **one-time** registration fee
before you can publish anything. **It used to sit beside submission in this list. It moved to
the front because item 37 needs a draft upload before the by-hand pass**, and you cannot
upload anything without an account.
<https://developer.chrome.com/docs/webstore/register>

**Use a dedicated email you check often. It cannot be changed after the account is
created**, and it is where every review alert arrives.

### 10–11. Submit, then wait

**Review is the long pole and it is not predictable.** Google: *"For most extensions,
review is completed within a few days, but it can take up to a few weeks."* If nothing has
happened after three weeks, contact developer support. As of April 2026 Google also reports
*a surge in submissions leading to extended review times*, so plan for the top of that
range rather than the bottom.

**What Google says slows a review, checked against this extension:**

| Trigger | Buki |
| --- | --- |
| New developer, new extension | **Yes, both.** Unavoidable and expected |
| Broad host permissions (`*://*/*`, `<all_urls>`) | **Yes** — `optional_host_permissions: ["https://*/*"]`. **This is the one to expect questions about**, and `permissions.md` already leads with the answer: `activeTab` plus one optional host permission requested on first use, never a broad permission at install |
| Sensitive permissions (`tabs`, `downloads`, `cookies`, `webRequest`) | **None.** The set is `storage`, `contextMenus`, `scripting`, `activeTab` |
| Code volume, obfuscation | ~193KB across five bundles, **unminified**, comments intact |

> **Do not "optimise" the build before submitting.** `build.mjs` does not minify, and that
> is an advantage here rather than an oversight: obfuscation is prohibited and minification
> is allowed, but *"the more code an extension contains, the more work it takes to verify
> that code is safe"*, and both complicate review. Readable, commented source is the
> easiest thing a reviewer can be handed. Shipping 193KB of legible JavaScript is a
> feature of this submission.

---

## Step 12. The CTA switch, and it is the first thing on launch day

`OPENWORK.md` item 36. Every install CTA on the landing points at GitHub, which is honest
while there is no listing. **The moment the item is published, five of them become the store
URL and three must not move:** the two `Source` links and `Report a problem` stay GitHub.

**Do not find-and-replace.** It would send `Source` to the Web Store and nobody would
notice, because it still goes somewhere plausible. `host.test.ts` fails a half-migration -
five links where three got updated - but it cannot tell you that `Source` went to the wrong
place, because that link is deliberately outside the set it checks.

The store URL carries the extension id, so it does not exist until publication. Same shape
as item 34, same day.

---

## Launch day

Zero users, zero list, one founder. That shapes everything: there is no audience to
announce to, so **day one is about being findable and being credible**, not about volume.

### The channels Buki actually has

| Kind | What exists | What is missing |
| --- | --- | --- |
| **Owned** | The landing, the GitHub repo | **No email list.** Nothing captures somebody who is interested but not ready |
| **Rented** | X — and it is the product's own home turf, which almost nothing else in this category can say | Nothing else, and nothing else is needed at this size |
| **Borrowed** | None yet | The book corner of X, and anyone whose audience already talks about what they are reading |

**The owned gap is the one worth closing, and it is small.** Every visitor who is not
ready to install is currently lost. That is a one-field capture on the landing, and it is
the difference between a launch that ends on launch day and one that compounds.

### The order on the day

1. **Post on X, from the product's own ground.** Not an announcement, a demonstration:
   a photograph of a stack of books, caught, landing on the shelf. The differentiator is
   visual and no competitor screenshot can show it.
2. **The landing is already the destination.** Every link goes there, not to the store
   listing, because the landing explains and the listing only installs.
3. **Answer everything, all day.** At zero users, every reply is a user.
4. **Product Hunt: not on day one.** It rewards preparation, relationships and a warm
   audience, and Buki has none of the three yet. It is a second launch moment, and it is
   better spent once there are real users and one screenshot of a real shelf.

### The one thing to say

The motto is locked and `docs/brand.md` owns the wording. **Find any book you see online,
instantly.** Do not improvise a new line on the day.

**And do not write "no server" or "no data" about the product as a whole.** Reading a cover
contacts one, ours by default. It is true of the shelf, and that is what the second line
says: *No account, no sync. Your shelf never leaves your browser.*

---

## What you can watch, and the honest problem

**You promised no analytics, and you meant it.** There is no telemetry, no error reporting
and no client instrumentation anywhere in the extension, by design. `privacy.html`, the
listing and the landing all say so.

**So you are launching with instruments on the server side only.** That is a real trade and
it is worth naming rather than discovering:

**One thing to check before launch day, because it is billed per event across EVERY project
on the team:** Vercel's **Observability Plus** is `$1.20 per 1 million events` and is enabled
by DEFAULT for teams created or upgraded to Paid Pro on or after 2026-04-03. It applies to
all projects unless you exclude them. Buki at zero users generates almost nothing; a busy
sibling project on the same team does not. **Exclude the noisy ones rather than turning it
off**, because 30-day retention is worth having on a launch where the client is deliberately
uninstrumented, and the free tier drops Pro retention to **one day**.
<https://vercel.com/docs/observability/observability-plus>

| You can see | You cannot see |
| --- | --- |
| Vercel function logs and invocation counts | How many people installed |
| Gemini spend, which is the truest signal you have | How many caught a book and kept it |
| Polar: subscriptions, activations, refunds | Where somebody gave up |
| Chrome Web Store: installs, ratings, reviews | Any error a user hits |

**The spend cap is therefore your primary alarm, not just a brake.** A cost spike is the
first thing that will tell you something is wrong, because nothing else reports.

**The shelf reports its own kept rate** (`23 caught · 78% kept`) and that number never
leaves the user's machine. It is the metric that matters most and the one you will only
ever learn by asking somebody.

---

## If something goes wrong

**An extension cannot be rolled back quickly, and that is the shape of the risk.** A
published version reaches users on Chrome's own update schedule; pulling it does not
un-install it. So the levers are server-side, and there are exactly three:

| Lever | Effect | Cost |
| --- | --- | --- |
| `BUKI_TRIAL_CLOSED=1` | Stops the free trial answering. **Paying subscribers are unaffected** — that scoping was itself a fix | Trial users see *"The free trial is closed just now"*. No deploy needed |
| Remove `GEMINI_API_KEY` | Stops all cover reading | **500s the product for everybody, including payers.** All or nothing |
| Provider spend cap | Bounds the money without our code noticing anything | Same all-or-nothing effect once hit |

**There is no partial brake for Pro traffic.** Registered in `OPENWORK.md` §6 as an
accepted risk, not an oversight. If Pro-classified traffic ever becomes the cost problem,
the only lever is the second row.

**A refunded subscriber keeps working for up to about eight days.** The session token is
stateless with no revocation list, which is the deliberate trade that makes a Polar outage
our problem rather than the customer's, and is why there is no database. Bounded and small
at $4/month. **Do not "fix" it with a revocation table** without re-opening that decision.

---

## After the first week

Nothing here is scheduled and none of it blocks launch.

- **Ask the first ten users one question:** what did you catch first. It is the only way to
  learn the kept rate, and it is the metric the whole product is built on.
- **The email capture**, if the launch produced anyone who wanted it and could not have it.
- **Product Hunt**, once there is a real shelf to screenshot and people who would show up.
- **Item 32's sibling work and anything the first users break.** `OPENWORK.md` stays the
  authority; add what you learn to §5 rather than to a handoff, because a handoff is read
  once and superseded.
