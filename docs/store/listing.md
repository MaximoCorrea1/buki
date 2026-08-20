# Chrome Web Store listing

> ## ⛔ DO NOT SUBMIT until all three of these are true
>
> The copy below describes the product **as it will be at submission**, which is not what a
> user gets today. `OPENWORK.md` item 22 records the decision that Buki ships only once the
> paid tier works, so this file is written forward rather than written twice.
>
> | Gate | Where |
> | --- | --- |
> | Gate 1: the Polar products exist, with the License Key benefit on **both** and activations enabled | **OPEN.** `OPENWORK.md` item 1, field by field in `docs/superpowers/polar-setup.md` |
> | Gate 2: the **six** Vercel variables are set and `/api/vision` answers | **NEARLY.** Five set 2026-08-19; `BUKI_EXTENSION_ID` waits on item 37 by design. `/api/vision` unprobed |
> | Gate 3: **a customer can actually pay** | **CLEARED 2026-08-18** (`1e29a7a`). Both Polar checkout links are on the Pro card inside `#pricing`, where every in-extension CTA lands |
>
> Until the first two, *"Ten catches from a photograph are free"* is a promise rather than a
> fact, because a user with no key of their own gets no cover reading at all. **Submitting
> before that is shipping a listing that misdescribes the product**, which is the one thing
> store review reliably catches.
>
> **The third gate is new on 2026-08-18 and it is the one a reviewer will hit by hand.**
> Every purchase CTA in the extension opens the landing's `#pricing`, whose Pro button links
> to GitHub — to install the extension the reviewer already has. A reviewer testing "Buki
> Pro is $4 a month" follows that button and finds no way to pay. The listing describes a
> paid tier; the product has to have a till.
>
> ~~One more gate: `docs/privacy.html` and the landing's data section still describe the
> picture going straight to the provider the user configured.~~ **CLEARED 2026-08-18**
> (`c0a3e00`). `docs/privacy.html`, `README.md` and both Web Store answers in
> `permissions.md` now name both paths and say what the server keeps. `permissions.md` has
> no DO-NOT-SUBMIT banners left.

**Rewritten 2026-08-17.** The previous version described the X-only, bring-your-own-key,
no-server product and had been stale since 2026-08-12. Positioning is
`.agents/product-marketing.md` v10; the differentiator is in `competitor-profiles/_summary.md`.

---

## Where each field actually comes from

This tripped the previous version, which offered a Name that contradicted the shipped
manifest. **Two of these fields are not typed into the dashboard at all.**

| Field | Source | Value today |
| --- | --- | --- |
| Name | `manifest.json` → `name` | `Buki` |
| Summary (short description, 132 max) | `manifest.json` → `description` | 100 characters, below |
| Detailed description | dashboard | below |
| Category, Language, Single purpose, Privacy URL | dashboard | below |
| Permission justifications | dashboard | **`docs/store/permissions.md`**, not here |

If the dashboard offers an editable title, it must match the manifest exactly. A store
title that disagrees with the manifest is a contradiction a reviewer can see without
leaving the page.

## Name

Taken from the manifest. Do not invent a longer one here:

```
Buki
```

The old value was `Buki: catch books from X`, which was both stale and a field the
dashboard does not own. The keywords belong in the summary and the detailed description,
which is where the store actually reads them.

## Summary / short description (132 characters max)

Already shipped in `manifest.json`, 100 characters, and correct:

```
Catch a book from any picture on the web into your own shelf, before it gets lost in your bookmarks.
```

Change it in `manifest.json` or the store and the code will disagree. `src/shared/host.test.ts`
does not guard this string; check it by eye when the manifest moves.

## Detailed description

```
You see a book on X, on Reddit, on Pinterest. You save the post, and never find it
again. It sinks under everything you saved after it, and months later you cannot tell the
ones you meant from the impulse saves.

Buki gives those books a place.

IT READS THE PICTURE, NOT THE CAPTION

Right-click any cover image and choose "Save book to shelf". X, Reddit, Pinterest, a
newsletter, a blog, anywhere there is a picture. Buki reads the picture together with the
words around it, checks the answer against OpenLibrary, and files it. That is the one that works on a photograph with no link and no
title written anywhere.

On X, Buki's own mark sits in the post's action bar and does the same thing in one press.

A photograph holding several books gives you several books, not just the clearest one.

NOW, NEXT, OR SOMEDAY

Every book gets an intention, so something you mean to read next month does not sit in the
same pile as something you saved on a whim. Mark it finished when you are done.

Nothing reaches your shelf until you pick a pile. Buki never saves a book for you.

IT TELLS YOU WHERE THE ANSWER CAME FROM

Every catch names its evidence: read from the cover, from the link in the post, or from
the post's own words. Buki also keeps a private count of how often you kept what it found,
so you can decide how much to trust it. That count never leaves your computer.

IT KEEPS THE POST THAT SOLD YOU

The picture you caught a book from is stored with the book. Months later you see not just
which book you saved, but why you wanted it.

YOUR SHELF IS YOURS

It lives in your browser. No account, no sign-up, no sync, no analytics. Export it to
Goodreads or StoryGraph whenever you like, free, on every plan. Uninstalling takes it all
with it.

WHAT IT COSTS

Ten catches from a photograph are free. No card, no account, nothing to set up.

After that, Buki Pro is $4 a month or $29 a year.

Free forever, with no limit: books caught from a shop link or from a post's own words,
your whole shelf, the piles, export, and unlimited cover reading with your own API key
from Google AI Studio or any OpenAI-compatible provider.

WHAT LEAVES YOUR COMPUTER, AND WHEN

Reading a cover from a photograph is the one thing Buki cannot do on your machine. When
you ask it to, that one picture is sent to Buki's server, which passes it to a vision
model and returns the answer. The picture is not stored and no account is attached to it,
because there is no account. Nothing else about you is sent, and nothing is sent unless
you ask for a catch.

If you would rather not involve us at all, add your own key in settings and the picture
goes straight to the provider you chose instead.

AFFILIATE DISCLOSURE

Saved books carry a Buy link. If you buy through it, Buki may earn a small commission at
no extra cost to you. It appears only on books you already saved, and it never changes
what Buki shows you. You can choose Amazon or Bookshop.org, which supports independent
bookshops.
```

**Named platforms, added 2026-08-19.** The description said *anywhere on the web* twice
where the landing has always said *"You see a book on X, on Reddit, in a newsletter"*
(`docs/index.html`), and `.agents/product-marketing.md` targets exactly those readers. The
abstraction was a specificity failure, not a voice decision, so the platforms were brought
across and nothing else moved. **Pinterest is the one addition that is NOT yet in the
positioning doc** - it is a good fit and it works the same way, by right-click, but it has
not been through the by-hand pass. `OPENWORK.md` item 3 should cover it before launch.

**The X button stays described as X-only**, which it is. Naming three platforms in one
breath risks implying a Buki button on all three; the sentence beneath keeps the mark in
the action bar on X and the right-click everywhere else, which is the truth.

**Why it is ordered this way.** The Web Store's long description is indexed, and the first
lines are what a browsing reader actually reads, so the problem goes first and the
differentiator ("reads the picture, not the caption") goes above every feature. Cost and
data sit near the bottom because they answer objections rather than create desire, but they
are stated plainly rather than buried: `.agents/product-marketing.md` records that the
affiliate disclosure is a **policy** requirement, not a courtesy, and that Chrome Web Store
policy permits affiliate links only when they are disclosed.

**No testimonials, no user counts, no ratings claims.** Zero users, pre-launch. Do not
invent one; the positioning doc says so in as many words.

## Category

`Workflow & Planning`

**Not `Productivity`, which this file said until 2026-08-19 and which no longer exists.**
The Chrome Web Store split its categories in mid-2023 and `Productivity` was one of the ones
that went; the dropdown will not offer it. Verified against
https://developer.chrome.com/docs/webstore/best-practices rather than recalled. The eighteen
current categories are Accessibility, Art & Design, Communication, Developer Tools,
Education, Entertainment, Functionality & UI, Games, Household, Just for Fun, News & Weather,
Privacy & Security, Shopping, Social Media & Networking, Tools, Travel, Well-being, and
Workflow & Planning.

`Workflow & Planning` is Google's own home for *"extensions that help users perform their
tasks more efficiently... to-do list managers"*, and the piles ARE that: Now, Next and
Someday exist so a book you mean to read next month does not sit beside one you saved on a
whim. **`Tools` is the fallback and would be a mistake** - it is explicitly *"tools that
don't fit into other categories"*, which is the shelf nobody browses.

**Do NOT pick `Social Media & Networking`**, however well X converts. The single-purpose
statement below deliberately covers any picture on the web, and a category scoped to social
media re-opens exactly the contradiction that field exists to close.

## Language

`English`

## Single purpose (required)

```
Buki identifies books shown in pictures on web pages and saves them to a reading list
stored in the user's own browser.
```

**This field is the one most likely to fail review, and the previous version would have.**
It said Buki *"identifies books shown in posts on x.com"*, scoped to one site, while
`manifest.json` asks for `scripting`, `activeTab` and an optional `https://*/*`. A
single-purpose statement narrower than the permissions it sits beside is precisely the
contradiction a reviewer looks for, and it reads as an extension asking for more than it
admits to.

The statement above is one purpose, not two, and it covers every entry point the manifest
actually has: the context menu on any page, Buki's mark in a post's action bar on X, and
the shelf in the popup. Saving is not a second purpose; it is what identifying is *for*.

**Permission justifications go in the dashboard's own fields, and they are written already
in `docs/store/permissions.md`.** Do not restate them here. That file is the one that
failed review before, and it now leads with the narrowest honest framing: `activeTab` plus
one optional host permission requested on first use, never a broad host permission at
install.

## Privacy policy URL

Must resolve, or review fails.

```
https://get-buki.vercel.app/privacy
```

Vercel serves `docs/` as the site root (see `vercel.json`). Redeploy with
`vercel deploy --prod`. Use the production domain, never a raw deployment URL: those are
SSO-protected on this account and a reviewer would hit a login wall.

**Rewritten 2026-08-18** (`c0a3e00`) and no longer false. It now names both paths - own
key goes straight to the provider, no key goes to Buki's endpoint - and states what the
server keeps: nothing on disk, no database, an IP and a scrambled licence-key digest in
instance memory with daily counts. The same words appear in `permissions.md` and `README.md`
on purpose. **If the three ever disagree, the code decides.**

## Screenshots: 1280x800, at least one, up to five

`OPENWORK.md` item 9, and it waits on item 3 so these show the current product. Shoot
against a shelf holding books actually saved. A mocked shelf reads as a mock.

**The staging for each one, what ruins it, and the video script are in
`docs/store/assets.md`.** The frames are built by `node tools/store-shots.mjs`, because the
store wants 1280x800 and the popup is 560px wide: every shot is composed rather than
cropped, and upscaling a 560px capture to fill the frame softens the type on a listing whose
whole claim is craft.

1. **The shelf**, face out: eight to twelve books across two or three boards, with the pile
   control visible above them. This is the one that sells it, so lead with it.
2. **A catch on a photograph holding several books**, showing the card with more than one
   book found and the three pile buttons unpressed. This is the differentiator and no
   competitor screenshot can show it.
3. **The search, then the find**, as a two-panel `split` frame: the *Reading the cover...*
   toast on the left, the resolved card on the right, the mark between them. Replaced *a
   catch somewhere that is not X* on 2026-08-20. **Two capture files, `zzz-shot-3a.png` and
   `zzz-shot-3b.png`**; there is no `zzz-shot-3.png`.
4. **Buki's mark** in a post's action bar, beside reply and like, so people see where it
   lives. It is the catcher at 18px, X's own icon size.
5. **The masthead count** (`23 caught, 87% kept`). Nothing else in this category publishes
   its own accuracy.

## Promotional tile: 440x280

The catcher on a light ground, wordmark to the right, one line beneath: "Catch books
before you forget them."

**The mark is the catcher**, a blue ball with two eyes, as of 2026-08-17. It is defined
once in `tools/mark.mjs` and every number in it was sampled from `icons/mark-source.png`.
Do not redraw it for the tile, and do not use the three-spine mark: that drawing is retired
on every surface. `docs/brand.md`, *The mark: THE CATCHER*.

---

## The dashboard fields this file did not cover until 2026-08-19

Maximo reached the real form and half of it was not written down anywhere. Every spec below
is quoted from Google's own documentation rather than recalled - the two pages that matter
are https://developer.chrome.com/docs/webstore/cws-dashboard-listing and
https://developer.chrome.com/docs/webstore/images.

### Store icon, 128x128 - AND OURS IS WRONG

> *"The actual icon size should be 96x96 (for square icons); an additional 16 pixels per
> side should be transparent padding, adding up to 128x128 total image size."*

`icons/icon128.png` is the **toolbar** icon and it is correct as a toolbar icon: the ball is
drawn full-bleed on transparency, 128 across, because `tools/make-icons.mjs` renders the mark
into the whole 0-100 space at every size and a toolbar icon wants no padding.

**The store icon is a different asset with a different rule, and uploading the toolbar one
puts our mark noticeably larger than every neighbour in a grid** - which in a listing whose
claim is craft reads as not knowing the spec rather than as confidence.

Do not "fix" `icons/icon128.png`; that would shrink the toolbar icon Chrome actually draws.
Produce a SEPARATE padded file. The rasteriser already isolates the geometry, so this is an
inset parameter, not a redraw. **The mark is a circle and 96 is Google's number for a
square**: a circle at the same bounding box reads smaller, so ~104 across, centred in 128,
is the honest optical match. Anything in 96-108 is defensible; 128 is not.

Alpha matters here: *"If you upload an image that has no alpha, it will be placed in a frame
with rounded corners (12-pixel corner radius)."* Ours is RGBA (colour type 6, verified by
reading the IHDR), so it will not be framed - which is right for a circle that would look
absurd inside a rounded square.

### Small promotional tile, 440x280 - AND GOOGLE CONTRADICTS THIS FILE

Google's guidance is two words: **"Avoid text."** Plus *"Make sure your image works even
when shrunk to half size."*

This file specified *the catcher on a light ground, wordmark to the right, one line beneath:
"Catch books before you forget them."* **The tagline goes.** At 220x140 a forty-character
sentence is a grey smear, which is the exact failure the half-size rule is about.

**The wordmark stays**, knowingly and against the letter of the rule. "Avoid text" is aimed
at marketing copy; a wordmark is identity, every recognisable tile in the store carries one,
and a nameless blue ball teaches a browsing reader nothing. So: **mark + wordmark, no
sentence.** Recorded as a deliberate deviation rather than an oversight.

### Marquee promotional tile, 1400x560

**Optional**, and the only one of the four assets that is. It is used for featured
placements, which are editorial and which a zero-user extension will not get on day one.
**Skip it at first submission.** If it is ever made: same rule, mark and wordmark, no
sentence, and it must survive being shown very wide and short.

### Screenshots, 1280x800

Already specified above and staged in `docs/store/assets.md`. One point from the spec that
the composed frames satisfy and a raw capture would not:

> *"Square corners, no padding (full bleed)"*

`tools/store-shots.mjs` outputs a full 1280x800 image with the ground running edge to edge,
so the frame IS the bleed. **A raw 560px popup capture dropped into the field is what that
rule forbids**, and it is what almost everybody does.

### Promotional video (YouTube URL)

**Optional. Leave it blank at first submission.** The 45-second script is written in
`docs/store/assets.md` and the video is worth having, but the field takes a real YouTube URL
and a listing is better with no video than with a placeholder. Add it after launch; the
field is editable without a new review of the package.

### Official URL

> *"Linked, official URL under the listing title"*, and it **requires site verification
> through Google Search Console.**

This is the verified-publisher line under the title and it is worth having: it is the one
signal on the page that says a real person owns the domain. `get-buki.vercel.app` can be
verified as a URL-prefix property because we serve `docs/` at the site root - drop Search
Console's HTML verification file into `docs/`, add it to `.vercelignore` **in the same
commit** (it is not a page), and redeploy.

**Not a launch blocker.** Leave it `None` if the account is not verified yet and add it
later.

### Homepage URL

```
https://get-buki.vercel.app
```

### Support URL

```
https://github.com/MaximoCorrea1/buki/issues
```

The landing's *Report a problem* already points here, and `OPENWORK.md` item 36 records that
this link and the two `Source` links **must not** move to the store URL on launch day. Using
the same destination keeps the promise in one place.

### Support and contact, and why there is no email

**Decided 2026-08-20: the GitHub issues page, and no email address anywhere.** The privacy
policy's Contact section points there too, deliberately.

A reviewer always has a route to the developer regardless: the Web Store shows the developer
account's own email on the listing, so adding one to a public, indexed page buys nothing a
reviewer needs and costs a permanently scrapeable address. **Revisit only if a real user
cannot reach us**, which is a problem that will announce itself.

### Mature content

**No.** For the record on what the toggle costs if it is ever set by mistake: *"Extensions
with mature content will not appear in Chrome Web Store search for users that are not logged
in."*

### Item support

**On.** The toggle only makes sense with a real destination behind it, and there is one.

### Visibility

Three options, and the names matter because the launch sequence uses two of them:

| Option | What it does |
| --- | --- |
| **Public** | *"lists your item on the Chrome Web Store for all users to see and install"* |
| **Unlisted** | *"does not create a listing... but does allow anyone to install your item if they know its Chrome Web Store URL"* |
| **Private** | *"limits installation of your item to specified users only. This is typically used for testing before public launch"* - trusted testers, and optionally a Google Group |

**Public at launch.** `Private` is worth knowing about but is NOT needed for item 37: pinning
`key` in `manifest.json` makes the unpacked id equal the published one, which is the entire
point of that item, so the by-hand pass on an unpacked build is valid once the key is in.
What `Private` would additionally buy is a test of the SIGNED package over the real install
path - a different instrument, not a required one. See `docs/store/launch.md` step 7.

There is also a separate publishing control worth knowing: *"If you uncheck the checkbox,
your item will not be published immediately after its review is complete. Instead, you'll be
able to manually publish it at a time of your choosing."* **Uncheck it**, so review passing
does not put us live on a random weekday morning before the landing CTAs move (item 36).
