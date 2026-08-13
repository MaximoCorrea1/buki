# Open work

**State as of 2026-08-13**, verified by running the commands, not from memory:

| | |
| --- | --- |
| Tests | 294 across 27 files, all passing |
| Typecheck | `tsc --noEmit` exit 0 |
| Build | `node build.mjs` clean |
| Working tree | clean |
| Branch | `buki-pro`, **28 commits ahead of `main`, not merged** |
| Plan | 37 steps done, 49 left |

**This file is an ordered checklist. Work it top to bottom.** Items are numbered across the
whole document so "do 7 next" is unambiguous. Each one says who can do it and what it
unblocks.

---

## Part 1. Maximo only. Nothing in Part 3 can start until 1 and 2 are done

- [ ] **1. Create the Polar product.** Two products, one per billing interval: Buki Pro
      Monthly $4 and Buki Pro Yearly $29. **Attach the License Key benefit to BOTH** or a
      yearly subscriber pays and gets nothing to paste in. Activation limit 5 on both.
      Also create the API key Polar asks for; that is `POLAR_ACCESS_TOKEN` below.
      The webhook Polar recommends is **not needed**: the design validates on demand and
      stores no subscription state, which is why there is no database.
      *Unblocks: item 2, then Tasks 6, 7, 9.*

- [ ] **2. Set five environment variables** in Vercel, project `buki`, all environments.
      **None of these may ever appear in a file under `src/extension/`.** That is a leak,
      not a shortcut.

      | Name | Notes |
      | --- | --- |
      | `GEMINI_API_KEY` | **Paid tier.** Create at https://aistudio.google.com/apikey then link billing at https://aistudio.google.com/plan_information. The free tier queues rather than erroring, which is what the 12-second hang on 2026-08-12 looked like, and "it does not throttle" is a line on the pricing page. |
      | `BUKI_TOKEN_SECRET` | 32+ random bytes, `openssl rand -base64 32` |
      | `BUKI_EXTENSION_ID` | from `chrome://extensions` with the extension loaded unpacked |
      | `POLAR_ACCESS_TOKEN` | from item 1 |
      | `POLAR_ORGANIZATION_ID` | Polar settings |

      Nothing reads these yet. `/api/vision` does not exist; that is Task 6.

- [ ] **3. Task 11 Step 5: verify catch-anywhere by hand.** Six checks, written out in
      `docs/superpowers/plans/2026-08-09-buki-pro.md` under Task 11. **No agent can ever
      tick this**: Chrome stable refuses `--load-extension` and `--disable-extensions-except`,
      so there is no headless substitute. The check most likely to fail is the permission
      prompt, because `chrome.permissions.request` needs the click's user gesture and no
      unit test can prove the gesture survived the await. Watch the service worker console:
      `could not ask for` means it threw.

---

## Part 2. Unblocked. An agent can start any of these right now

Ordered by value. 4 and 5 came out of the code review on 2026-08-13.

- [ ] **4. Make `ensureTray` and `mayFetch` testable.** `src/extension/background.ts:309`
      and `:337`. They call `chrome.scripting` and `chrome.permissions` directly, so they
      cannot be tested at all, which contradicts this project's own convention:
      `src/extension/storage.ts:39` says *"Minimal shape of chrome.storage.local we depend
      on, so this tests without Chrome"*, and `trial.ts` takes `deps.storage`. The riskiest
      behaviour in the whole feature has zero coverage and is also the part only item 3 can
      check. **Fix:** `ensureTray(tabId, { tell, inject })` and `mayFetch(url, { request })`.

- [ ] **5. Guard the host against drift.** `src/shared/host.ts` says it is the one
      definition of the production host. Nothing imports it, and the landing cannot: the
      host is hardcoded in `docs/index.html` five times plus `llms.txt`, `sitemap.xml`,
      `robots.txt` and `pricing.md`. As written, the next rename repeats exactly the
      failure that file was created to prevent. **Fix:** a test, or a check in `build.mjs`,
      asserting `docs/index.html`'s canonical URL equals `BUKI_HOST`.

- [ ] **6. Give the two silent early returns some feedback.**
      `src/extension/background.ts:367-368`. Decline the permission prompt, or right-click
      an image on a `chrome://` page or the Web Store, and the menu item does nothing with
      no explanation at all. The decline case at least has Chrome's own prompt as context;
      the injection failure has nothing. **Fix:** a brief `chrome.action.setBadgeText`,
      which is the only feedback channel that works on a page extensions cannot touch.

- [ ] **7. Goodreads and StoryGraph export.** *(see §2.1 below)* The last thing the product
      sells that does not exist.

- [ ] **8. The landing: eyebrows and dark mode.** *(see §4 for the eyebrow decision, which
      is Maximo's)* Dark mode is the one pre-flight box that cannot be ticked today. The
      plates can be re-rendered inverted by swapping the endpoints in `tools/plates.sh`,
      and `icons/icon.svg` already survives a dark ground.

- [ ] **9. Screenshots for the Web Store.** Five at 1280x800. **Do 8 first**, and item 3,
      so they show the redesigned product doing catch-anywhere rather than the X-only one.
      Shoot against a shelf of books actually saved; a mocked shelf reads as a mock.
      *Unblocks item 15.*

### 2.1 Goodreads and StoryGraph export is promised and does not exist

The pricing section and `docs/pricing.md` both say "Export to Goodreads and StoryGraph".
There is no task for it in the plan and no code. **It must ship before Pro is advertised
with that line**, or the page is selling something that is not there. Goodreads closed its
write API in 2020, so a Goodreads-format CSV is the only route into both.

`docs/pricing.md` makes this worse than it was: a machine-readable file is the kind of
thing an AI agent quotes verbatim when comparing tools.

---

## Part 3. Blocked on Part 1. Plan tasks, in dependency order

Each is fully specified in `docs/superpowers/plans/2026-08-09-buki-pro.md` with complete
code. Tasks 1 to 5 are done and tested; these are the wiring.

- [ ] **10. Task 6, the vision proxy.** 5 steps. Needs items 1 and 2.
- [ ] **11. Task 7, exchanging a licence for a session.** 4 steps. Needs item 10.
- [ ] **12. Task 8, the extension holds a licence.** 5 steps.
- [ ] **13. Task 9, settings learn about the licence.** 6 steps. Needs item 11.
- [ ] **14. Task 10, the worker gates a catch.** 6 steps. Needs items 12 and 13.
- [ ] **15. Task 12, the wall.** 9 steps. The paywall UI.
- [ ] **16. Task 13, the options page holds a licence.** 4 steps.
- [ ] **17. Task 14, the documents that are now false.** 4 steps. *(see §3 below)*
- [ ] **18. Task 15, close the loop.** 4 steps.
- [ ] **19. Merge `buki-pro` into `main`.** 28 commits and counting. Use
      `superpowers:finishing-a-development-branch`.

---

## Part 4. Decisions only Maximo can make

- [ ] **20. The eyebrow conflict.** Two skills disagree and I am not silently splitting the
      difference. `impeccable`'s craft floor **bans** the small uppercase label above a
      heading outright: *"no brief earns it back"*. `taste-skill` permits a ration of
      `ceil(sections / 3)`. The landing currently has three, at the ration limit:
      `THE GESTURE`, `WHAT YOU END UP WITH`, `WHAT IT COSTS`.
      **My recommendation: delete all three.** The headlines carry themselves.

- [ ] **21. The catch tray is the last surface on the old design system.**
      `src/extension/content.ts` is still the violet-black room with one warm lamp. The
      popup and options page were realigned on 2026-08-12; the tray was deliberately left,
      because it is the only surface that renders **inside somebody else's page**. That is
      a different problem: it has to hold up against an arbitrary background rather than
      one we chose. **Do not retheme it by copying tokens across without solving that
      first.**

- [ ] **22. Ship free-first, or wait for the paid tier?** The landing sells ten free hosted
      catches and $4/month. Neither exists: today Buki needs the user's own Gemini key.
      Shipping the free build means rewriting the landing back to bring-your-own-key, which
      is the narrow product already rejected as the pitch. Waiting means the Web Store
      review clock does not start. **My recommendation: wait**, because the positioning doc
      says the goal is validating that *removing setup friction converts*, and
      bring-your-own-key is that friction.

---

## 3. The store documents are stale and one of them fails review

Both carry banners saying so. `docs/store/listing.md` describes the X-only,
bring-your-own-key, no-server product: the name, the short description and the whole
detailed description are the narrow version.

**`docs/store/permissions.md` is the one that fails review.** It says *"Nothing is
transmitted"*, which stops being true the day the proxy ships, and it does not justify the
three permissions now in the manifest:

| Permission | Why it is needed |
| --- | --- |
| `scripting` | Inject the catch tray into a tab that has no content script |
| `activeTab` | The grant a context-menu click gives, which makes that injection legal without host access at install |
| `https://*/*` optional | Fetch a cover from a CDN that is not the tab's own origin |

The narrowest honest framing is the one to use: `activeTab` plus an optional host permission
requested on first use, **not** a broad host permission at install. Say that explicitly,
because a reviewer comparing the manifest against this file is exactly who it is for.

That is item 17.

---

## 4. Things that are done, so nobody re-opens them

- **The Vercel rename.** Production domain is `https://get-buki.vercel.app`, defined once
  in `src/shared/host.ts`. Every shipped file that carried the old host was updated.
- **Plate provenance.** Both plates are public domain 18th-century capricci from Wikimedia
  Commons, credited in the page footer. The old ones came from X media ids with unknown
  rights and were an open legal risk for two sessions.
- **Catch-anywhere.** Task 11 is built and committed. Only the manual check remains, item 3.
- **The mark.** `icons/mark.svg` and `icons/icon.svg`. See `docs/brand.md` for why the
  caught spine is a light blue and not the cobalt accent, and why the icon has a plate.
- **The popup and options page** follow the landing as of 2026-08-12.

---

## 5. Traps that have already cost time

- **A retokening that changes an accent's LIGHTNESS invalidates every hardcoded colour
  sitting on it.** Moving `--accent` from amber to cobalt left the options save button at
  `#241705` on `#1231a8`, which measures 1.69:1 and is an unlabelled button. Grep for hex
  literals near any token you relight.
- **`str.replace` does not fail when it matches nothing.** Three font swaps silently did
  nothing because the real declaration was `15px/1.55` and the search string said
  `15px/1.5`. Assert the match or diff the result.
- **A whole-document `replace(..., 1)` hits the first match in the FILE, not in the
  section.** Two checkboxes were ticked in the wrong task that way. Scope to the section.
- **Diacritics change a generated cover's dye.** `hashOf` runs over the raw string, so
  correcting `Stanisław Lem` moves Solaris from tobacco to forest.
- **Windows and Git Bash:** `npm run` and `npx` both fail here. Use
  `./node_modules/.bin/vitest run`, `node node_modules/typescript/bin/tsc --noEmit`,
  `node build.mjs`. Chrome is at
  `/c/Program Files (x86)/Google/Chrome/Application/chrome.exe`, and it refuses
  `--load-extension`. Chrome also clamps its window width to about 485px, so a true mobile
  viewport needs the iframe harness, not `--window-size`.
- **`popup.html` renders nothing outside an extension host.** It is `<main id="app">` and
  draws itself from `chrome.storage`. Use `node tools/popup-harness.mjs`.
