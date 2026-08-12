# Chrome Web Store listing

> ## ⚠ STALE. Do not submit this as written. Last accurate at `3175abd`.
>
> Every line below describes the **X-only, bring-your-own-key, no-server** product. Three
> things on the `buki-pro` branch invalidate it, and each one is a separate rewrite:
>
> | What changed | What this file must say instead |
> | --- | --- |
> | Catch works on **any image anywhere**, not just X (plan Task 11) | The name, the short description and the whole detailed description. "catch books from X" is the narrow version of the product and it is no longer the pitch. |
> | Recognition is **hosted**, with ten free catches then $4/month or $29/year | The listing must disclose that a paid tier exists and that recognition contacts a Buki server. |
> | The landing and the mark were **redesigned** (2026-08-11) | The promo tile and screenshot shot-list, which describe the old lamp artwork. |
>
> **Nothing here can be finalised until the Vercel rename lands**, because the privacy URL
> in this file has to point at the production domain and a 404 there fails review. See
> `OPENWORK.md` §1.1 and plan Task 14.
>
> The positioning to write against is in `.agents/product-marketing.md`, and the
> differentiator is in `competitor-profiles/_summary.md`.

Everything here is copy-paste ready. Fields match the Web Store developer dashboard.

## Name

```
Buki: catch books from X
```

## Short description (132 characters max)

```
Catch books you see on X into your own shelf, before they get lost in your bookmarks.
```

## Detailed description

```
You see a book in a post, save it, and never see it again. It sinks under memes and
threads, and there's no way to tell the ones you meant it about from the impulse saves.

Buki gives those books a place.

TWO WAYS TO CATCH A BOOK

• Right-click a cover image and choose "Save book to shelf". Buki reads the cover and
  the post's words together, checks the result against OpenLibrary, and files it. This is
  the one that works on a photo with no link and no title in the text.

• Hit the book icon on a post. Same recognition, and you pick where the book goes.

NOW, NEXT, OR SOMEDAY

Every book gets an intention, so something you mean to read next month doesn't sit in the
same pile as something you saved on a whim. Mark it finished when you're done.

IT TELLS YOU WHEN IT'S UNSURE

Every catch names its evidence: read from the cover, from a link in the post, or
unverified when the catalogue could not confirm it. Nothing reaches your shelf until you
pick a pile, so a wrong guess costs you a glance rather than a cleanup. Buki also keeps a
private count of how often it got it right, so you can decide how much to trust it. That
count never leaves your computer.

YOUR SHELF IS YOURS

It lives in your browser. No account, no sync, no analytics, nothing to sign up for.
Uninstalling takes it all with it.

ONE-TIME SETUP

Reading a cover from a photo is the one thing Buki can't do on your machine, so it
needs a vision model. Paste a free key from Google AI Studio. About two minutes, no
billing details. Any OpenAI-compatible endpoint works instead.

Without a key, Buki still catches books from retailer links and from a post's own
words. Only reading a cover from a photo needs one.

AFFILIATE DISCLOSURE

Saved books carry a Buy link. If you buy through it, Buki may earn a small commission
at no extra cost to you. It appears only on books you already saved, and it never changes
what Buki shows you. You can choose Amazon or Bookshop.org, which supports independent
bookshops.
```

## Category

`Productivity`

## Language

`English`

## Single purpose (required)

```
Buki identifies books shown in posts on x.com and saves them to a reading list stored
in the user's own browser.
```

## Privacy policy URL

Already live. Paste this:

```
https://get-buki.vercel.app/privacy
```

Vercel serves `docs/` as the site root (see `vercel.json`). Redeploy with
`vercel deploy --prod`. Use the project's production domain, never a raw deployment URL:
those are SSO-protected on this account and a reviewer would hit a login wall.

## Screenshots: 1280×800, at least one, up to five

Take these against a shelf with **real** books you actually saved. A mocked shelf reads
as a mock.

1. **The shelf**, face out: eight to twelve books across two or three boards, with the
   pile control visible above them. This is the one that sells it, so lead with it.
2. **A catch in progress** on a real post: the card in the corner with a book found and
   the three pile buttons unpressed.
3. **The book icon** in a post's action bar, so people see where it lives.
4. **The masthead stat** (`23 caught · 87% kept`). Nothing else in this category shows
   you its own accuracy.

## Promotional tile: 440×280

The mark on a `#F4F2FB` ground, wordmark to the right, one line beneath:
"Catch books before you forget them."
