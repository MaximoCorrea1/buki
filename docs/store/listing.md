# Chrome Web Store listing

> ## ⛔ DO NOT SUBMIT until all three of these are true
>
> The copy below describes the product **as it will be at submission**, which is not what a
> user gets today. `OPENWORK.md` item 22 records the decision that Buki ships only once the
> paid tier works, so this file is written forward rather than written twice.
>
> | Gate | Where |
> | --- | --- |
> | The Polar products exist, with the License Key benefit on **both** and activations enabled | `OPENWORK.md` item 1, field by field in `docs/superpowers/polar-setup.md` |
> | The **six** Vercel variables are set and `/api/vision` answers | `OPENWORK.md` item 2 |
> | **A customer can actually pay** | `OPENWORK.md` item 34 |
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
You see a book in a picture, save the post, and never find it again. It sinks under
everything you saved after it, and months later you cannot tell the ones you meant from
the impulse saves.

Buki gives those books a place.

IT READS THE PICTURE, NOT THE CAPTION

Right-click any cover image anywhere on the web and choose "Save book to shelf". Buki
reads the picture together with the words around it, checks the answer against
OpenLibrary, and files it. That is the one that works on a photograph with no link and no
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

`Productivity`

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
3. **A catch somewhere that is not X**, so the breadth in the single-purpose statement is
   visible rather than asserted.
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
