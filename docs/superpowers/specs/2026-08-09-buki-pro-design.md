# Buki Pro, and a book caught anywhere: design

**Date:** 2026-08-09 · **Status:** approved, PLANNED AND LARGELY BUILT — see the banner

> ## PARTLY SUPERSEDED, 2026-08-17
>
> This is a dated record of the design decision and is kept as written, because the
> reasoning is why the paid tier is shaped the way it is. Three things in it are no longer
> true, and the first was actively wrong to leave standing:
>
> 1. **Export is FREE on every tier**, and has been since 2026-08-13. The table below says
>    Pro-only, and the section near the end plans it as a Pro feature. That is the one
>    claim in this file a reader could act on and be wrong: `.agents/product-marketing.md`
>    v4 records the change, and `docs/pricing.md` is the contract.
> 2. **The settings shape is not what this file drafts.** The licence and its session live
>    in their own record (`src/extension/proState.ts`, key `buki-pro`), deliberately apart
>    from `visionSettings`, which the user is invited to edit. A bearer credential and a
>    provider preference should not share a lifetime.
> 3. **The trial is enforced client-side by `entitlement.ts` + `gate.ts`**, with a per-IP
>    brake on the proxy as a second line rather than the accounting.
>
> For what is built, read `OPENWORK.md` items 10–16. For the plan's step-level state,
> `docs/superpowers/plans/2026-08-09-buki-pro.md`.

Two changes ship together because neither is worth much alone. Buki learns to catch a book
from any image anywhere on the web, and it learns to charge for doing the reading itself.

Selling hosted recognition while the extension only works on one website would be charging
for the narrow version of the product. Widening to the whole web without a way to pay for
the recognition would mean paying for every stranger's catches out of pocket. Together they
are one product: **the thing that catches a book wherever you see it.**

For what the product does today, read `README.md`. For positioning and voice,
`.agents/product-marketing.md`. For the competitive picture that motivated the widening,
`competitor-profiles/_summary.md`. For the design system, `docs/brand.md`.

---

## 1. What is being sold, and what is not

| | Free | Pro, $4/month or $29/year |
| --- | --- | --- |
| Catches from a retailer link | unlimited, forever | unlimited |
| Cover-photo catches, hosted | **10**, then the wall | **unlimited** |
| Cover-photo catches, own key | unlimited, forever | unlimited |
| Every book in one photo | yes | yes |
| Works on any image, anywhere | yes | yes |
| The shelf, piles, search, Buy links | yes, forever | yes |
| No key, no setup, no throttling | no | **yes** |
| Export to Goodreads and StoryGraph | **yes, since 2026-08-13** | yes |
| Sync and backup | not built yet | included when it ships |

**Three things are never gated, at any point, including after the trial is spent.**

1. **The shelf you already have.** Every book stays, opens, moves pile and links to Buy.
   Holding a user's own local data hostage would be worth one bad thread and every star we
   have. It is also removable in five minutes by anyone with the MIT source.
2. **Catches from a retailer link.** They cost nothing to serve, because no vision call
   happens. Charging for them would be charging for arithmetic.
3. **Bring your own key.** Kept as a quiet line in options rather than the headline. The
   two audiences are disjoint: whoever will paste a Gemini key was never going to pay $4,
   and whoever will pay $4 was never going to paste a key. Keeping it costs nothing, and it
   is the answer to "you paywalled an MIT extension" before anybody asks.

### Two decisions that changed while specifying

- **The trial is ten catches, not five.** Cost is not the constraint: one catch is about
  **$0.00011**, so ten catches per installer is $0.0011 and ten thousand installs is about
  $11. The constraint is design. Books stand four to a board, so eight to ten books is the
  point where the shelf stops being a list and starts being furniture. That is the aha, and
  the trial has to reach it.
- **Pro is unlimited, not a 150/month quota.** A per-user monthly quota cannot be counted
  without a database, and at these unit costs it would exist to prevent a problem that
  costs cents. An abusive Pro user catching ten thousand books costs about **$1.10** against
  $4 collected. "Unlimited" is simpler to build, simpler to say, and honest. If abuse ever
  appears, a cap can be added without a schema change.

### The offer, complete

**Name:** Buki Pro. **Price:** $4/month or $29/year. **Risk reversal**, three parts, all
structurally true rather than promised:

1. **Cancel and you keep every book you caught.** Nothing is ever held hostage.
2. **You never pay to find out whether it works.** Ten catches, no card, no account.
3. **14 days, refunded, no questions.** Polar is merchant of record, so it is their flow.

No countdown timers, no bonus stack, no invented "value". The voice in `docs/brand.md`
forbids it and this audience would smell it immediately.

### The economics, recorded so nobody re-derives them

Polar restructured on 2026-05-27. A new organisation is on **Starter: 5% + 50c**, plus
1.5% on non-US cards, $15 per dispute, $2/month payout fee.

| Price | Fee | Kept | Drag |
| --- | --- | --- | --- |
| $4/month | $0.70 | $3.30 | 17.5% |
| $29/year | $1.95 | $27.05 | 6.7% |

Annual is the number to push. Monthly exists as the low-commitment door, and it is
deliberately the worse deal for us.

---

## 2. A book caught anywhere

Today the context menu is scoped to twitter.com and x.com by `documentUrlPatterns`, for a
reason recorded in `background.ts`: off those pages there is no content script, so a save
would mutate the shelf with no visible feedback. **That is a feedback problem, not a
recognition problem**, and the recognition path never cared what site it was on.

**The tray is injected on demand.** A context-menu click is a user gesture, which grants
`activeTab` for that tab, which is exactly enough to run `chrome.scripting.executeScript`
there. No `<all_urls>` content script, no broad host permission at install.

```
right-click an image, anywhere
        │
        ├─ tab already has the tray?          ── yes ──►  message it
        │        (twitter.com / x.com)
        └─ no ──► chrome.scripting.executeScript(dist/content.js)  [activeTab]
                          │
                          └─► tray appears, catch proceeds exactly as on X
```

**Fetching the picture** is the one thing that needs more. The worker fetches `info.srcUrl`
to inline it, and a cover usually sits on a CDN that is not the tab's origin, so `activeTab`
is not enough. `optional_host_permissions: ["https://*/*"]` is **already declared in the
manifest** and goes unused today. It is requested the first time somebody catches a book
off X, with a sentence explaining why, and never again.

Images on X are on `pbs.twimg.com`, which is already in `host_permissions`, so **the
existing flow gains no new prompt.**

### Manifest changes

| Change | Why |
| --- | --- |
| add `"scripting"` to `permissions` | inject the tray into an arbitrary tab |
| add `"activeTab"` to `permissions` | the grant that makes injection legal without host access |
| context menu `documentUrlPatterns` removed | the menu item appears on any image |
| `optional_host_permissions` unchanged | already correct, finally used |

### The honest limit

An injected tray cannot read a post's words the way the X content script does, because
there is no post. Off X a catch has the picture and nothing else, which is a weaker signal:
the caption is often what makes a hard cover legible. The tray says so when it comes back
uncertain, rather than pretending the two cases are equal.

---

## 3. Architecture

**The recognition path barely changes.** `createLlmVision` already speaks the OpenAI
chat-completions shape, already sends `Authorization: Bearer <apiKey>` only when a key
exists, and `VisionConfig.apiKey` is already documented as *"omitted when a proxy holds the
credential, which is how users stay keyless."* Buki's server is simply another endpoint of
a shape the client already speaks.

```
                    ┌─ retailer link ─────────────────────────► OpenLibrary   free, no vision
  catch ─► recognizer┼─ cover photo ──► VisionClient ──┐
                    └─ post text ─────────────────────┼─────► OpenLibrary
                                                      │
                              endpoint = settings.endpoint
       ┌──────────────────────┬───────────────────────┴────────────┐
       ▼                      ▼                                    ▼
  own key, free         Buki proxy, trial                  Buki proxy, Pro
  generativelanguage    no Authorization header             Authorization: Bearer <session>
  Bearer <user key>     origin + IP + global caps           HMAC session token, 24h
```

### The server: one Vercel function, no database

The `shelfy` Vercel project already exists and serves `docs/` statically. This adds an
`api/` directory beside it.

**The host is not decided yet, and it blocks the default endpoint.** The project still
answers on `shelfy-pearl.vercel.app`, from the product's old name, and `OPENWORK.md` §2.3
records that renaming retires the old domain immediately. Since
`DEFAULT_SETTINGS.endpoint` will be baked into every installed copy, **the rename has to
happen before the endpoint is chosen**, or the first shipped build points at a domain that
is about to 404. This is the one prerequisite an agent cannot do: it needs Maximo in the
Vercel dashboard. The plan must sequence the rename first and read the host from one
constant, so a change is one line rather than a search.

| Route | Does |
| --- | --- |
| `POST /api/vision` | Accepts a chat-completions body, authorises it, forwards to Gemini with the server's key, returns the provider's response verbatim so `llmVision` parses it unchanged |
| `POST /api/license` | Takes a license key, validates it with Polar, returns a signed session token |

**Trial requests** carry no Authorization header. The server requires
`Origin: chrome-extension://<published id>`, applies a per-IP daily cap and a global daily
kill switch. Forgeable with curl, and that is accepted: the defence is proportional to a
threat that costs hundredths of a cent.

**Pro requests** carry a session token. The server verifies the HMAC locally and forwards.
No Polar call, no database read, no network hop.

### The session token, and why it exists

`POST /api/license` calls Polar's `POST /v1/license-keys/activate` server-side with the
organisation token, then returns an HMAC-signed token containing the license key id, the
activation id and an expiry 24 hours out.

Three things fall out of that, all of them free:

1. **Polar is called once a day per user, not once per catch.** Recognition latency never
   includes a licensing round trip.
2. **A Polar outage is invisible to paying customers.** On refresh, if Polar cannot be
   reached and the client presents a token that is correctly signed but recently expired,
   the server issues a **grace token**. An expired Buki-signed token is itself proof that
   this license validated within the last day. Grace is capped at 7 days, then it fails
   closed. This is the same instinct as `breaker.ts`: a dead dependency must not become the
   user's problem.
3. **Still no database.** Nothing is stored server-side. The token is the state.

**Usage metering is deliberately not implemented.** Polar's `increment_usage` exists and is
not used, because Pro is unlimited and counting would only serve a cap that does not exist.

### Client modules

Three new files, all pure, all tested in node with no DOM, matching `shelfView.ts` and
`breaker.ts`.

| File | Owns | Depends on |
| --- | --- | --- |
| `src/extension/entitlement.ts` | The state machine: `trial(n left)` → `spent` → `pro` → `lapsed`. Decides whether a catch may proceed, and what the tray says. Pure, no I/O. | types only |
| `src/extension/license.ts` | Exchanging a license key for a session token, caching it, honouring expiry and grace, re-exchanging silently on 401. | injected `fetch` |
| `src/extension/trial.ts` | Counting hosted catches in `chrome.storage.local`. | injected `StorageArea` |

**A trial catch is only spent on a reading that came back.** The counter decrements when
the proxy returns candidates, and never when the model found no book, when the request
timed out, when OpenLibrary refused to ground it, or when the user dismissed the card
without choosing a pile. Charging one of ten free catches for a failure is the fastest way
to make somebody uninstall, and it would also make the trial shorter than advertised.
Retailer-link catches and own-key catches never touch it at all.

**`trial.ts` is deliberately forgeable.** The count is local and a determined user can
clear it. Defending it needs identity, which needs accounts, which needs a database, to
protect a resource worth one hundredth of a cent. Anyone resetting storage every ten books
was never going to pay.

### Settings

`Settings` gains two fields beside the existing four. The storage key `visionSettings` does
not move.

```ts
export interface Settings {
  apiKey: string;      // the user's OWN provider key. unchanged.
  endpoint: string;    // now defaults to Buki's proxy, not Gemini directly
  model: string;
  store: Store;
  license: string;     // the Polar license key, as pasted. '' when free.
  session: string;     // the cached HMAC session token. '' when none.
}
```

`toVisionConfig` chooses which credential travels: the user's own key when the endpoint is
a third-party provider, the session token when the endpoint is Buki's proxy, and nothing at
all during the trial. `visionFor`'s existing `providerNeedsKey` regex already excludes
Buki's domain, so a blank key on the proxy is already legal.

### Error handling

The existing separation in `VisionHttpError.permanent` already sorts "fix your setup" from
"try again". One case joins it:

| From the proxy | Means | The tray says |
| --- | --- | --- |
| `402` | trial spent, no license | the wall, with two doors |
| `401` | session token bad or expired | silently re-exchange, retry once, then the wall |
| `429` | IP or global cap hit | "Too many catches right now. Try again in a minute." |
| `503` + `X-Buki-Grace` | serving on grace, Polar unreachable | nothing. The user must not learn about our vendor's outage. |

A `402` is neither an error nor a retry. It is an offer, and it must not be logged as a
recognition failure: the kept rate measures how good the reading is, and a catch that never
reached the model is not a miss.

### The paywall surface

The wall is a **state of the existing catch tray**, not a new component. Three rules, from
the paywall discipline and from `docs/brand.md`:

1. **Never spring it.** Once three or fewer remain, the tray footer carries a quiet
   `3 catches left`, counting down to `1 catch left`. The wall is never a surprise.
2. **Two doors, never one.** "Get Buki Pro" and "Use your own key, free". A paywall with no
   exit is a dark pattern, and here the exit genuinely exists.
3. **Respect the no.** Dismissed once, it does not reappear for 24 hours. It degrades to a
   single line rather than asking again on every catch.

Copy is written against `.agents/product-marketing.md`. No guilt, no urgency, no counter
ticking down.

---

## 4. What must change outside the code

**These are not optional and they ship in the same commit as the proxy.** The landing
currently says *"There is no Buki server to send it to."* From the moment recognition is
hosted by default that sentence is false, and an inaccurate data-usage declaration fails
Chrome Web Store review.

| File | Change |
| --- | --- |
| `docs/index.html` | Rewrite the "Your data" section. Lead on catching anywhere, not on X. |
| `docs/privacy.html` | Name the proxy, what it receives, what it keeps, and for how long |
| `docs/store/permissions.md` | Justify `scripting`, `activeTab`, and the optional host permission. Re-check the data-usage declaration end to end. |
| `docs/store/listing.md` | New shot list, new description, the price |
| `README.md` | Setup section is now "there is no setup" |

The honest replacement is still strong, and shorter: *the picture you asked us to identify
goes to Buki and to the model. Nothing else does. No account, no tracking, and your shelf
never leaves your computer.*

---

## 5. Testing

Everything decidable without a DOM is decided in a tested module, which is the split this
repo already enforces because the test runner is node with no document.

| Unit | Proves |
| --- | --- |
| `entitlement.ts` | Every transition, including `pro` → `lapsed` → `trial spent` and the boundary at exactly 10 |
| `trial.ts` | Counts only hosted catches. A retailer-link catch and an own-key catch never decrement it. |
| `license.ts` | Token cached, expiry honoured, 401 re-exchanges exactly once, grace accepted within 7 days and refused after |
| `api/vision` | Trial without origin refused, per-IP cap, valid session passes, bad HMAC refused, Polar outage produces a grace token, expired-beyond-grace refused |
| existing 228 tests | Still green. The recognition path is not being changed. |

Each test is proved to discriminate by breaking the implementation and watching only that
test fail, as every other invariant in this repo is.

---

## 6. Explicitly out of scope

**Sync, backup, accounts and the database.** It is the reason to keep paying after month
one and it needs its own spec: identity, conflict resolution when two browsers disagree,
and a migration for shelves that already exist locally. Promised in the tier table as
"included when it ships", which is a promise this design does not spend.

**Per-user usage quotas.** See section 1.

**Goodreads and StoryGraph CSV export.** Listed as a Pro feature and planned last, so that
if the session runs short it is the thing that slips rather than the licensing rail.

---

## 7. Risks

| Risk | Response |
| --- | --- |
| Google adds "save" to Lens | Recognition was never the moat. The shelf, the piles and the post that sold you are. |
| TBR Bookmarker adds image recognition | The most likely competitive move. They have the audience; we have provenance and a head start on the picture. |
| Store review rejects the permission widening | `activeTab` plus an optional host permission is the narrowest possible ask. `permissions.md` must argue it explicitly. |
| The proxy's Gemini key leaks or is drained | Caps and a global kill switch on day one. The key is never in the bundle. |
| Nobody pays | The whole reason the trial is ten and not five, and the reason the free tier never degrades. |
