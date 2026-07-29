# Chrome Web Store listing

Everything here is copy-paste ready. Fields match the Web Store developer dashboard.

## Name

```
Shelfy — catch books from X
```

## Short description (132 characters max)

```
Catch books you see on X into your own shelf, before they get lost in your bookmarks.
```

## Detailed description

```
You see a book in a post, save it, and never see it again. It sinks under memes and
threads, and there's no way to tell the ones you meant it about from the impulse saves.

Shelfy gives those books a place.

TWO WAYS TO CATCH A BOOK

• Right-click a cover image and choose "Save book to shelf". Shelfy reads the cover and
  the post's words together, checks the result against OpenLibrary, and files it. This is
  the one that works on a photo with no link and no title in the text.

• Hit the book icon on a post. Same recognition, and you pick where the book goes.

NOW, NEXT, OR SOMEDAY

Every book gets an intention, so something you mean to read next month doesn't sit in the
same pile as something you saved on a whim. Mark it finished when you're done.

IT TELLS YOU WHEN IT'S UNSURE

A strong match saves outright. A weak one asks first, rather than quietly putting the
wrong book on your shelf. Shelfy also keeps a private count of how often it got it right,
so you can decide how much to trust it — that count never leaves your computer.

YOUR SHELF IS YOURS

It lives in your browser. No account, no sync, no analytics, nothing to sign up for.
Uninstalling takes it all with it.

ONE-TIME SETUP

Reading a cover from a photo is the one thing Shelfy can't do on your machine, so it
needs a vision model. Paste a free key from Google AI Studio — about two minutes, no
billing details. Any OpenAI-compatible endpoint works instead.

Without a key, Shelfy still catches books from retailer links and from a post's own
words. Only reading a cover from a photo needs one.

AFFILIATE DISCLOSURE

Saved books carry a Buy link. If you buy through it, Shelfy may earn a small commission
at no extra cost to you. It appears only on books you already saved, and it never changes
what Shelfy shows you. You can choose Amazon or Bookshop.org, which supports independent
bookshops.
```

## Category

`Productivity`

## Language

`English`

## Single purpose (required)

```
Shelfy identifies books shown in posts on x.com and saves them to a reading list stored
in the user's own browser.
```

## Privacy policy URL

Already live. Paste this:

```
https://shelfy-pearl.vercel.app/privacy
```

Vercel serves `docs/` as the site root (see `vercel.json`). Redeploy with
`vercel deploy --prod`. Use the project's production domain, never a raw deployment URL —
those are SSO-protected on this account and a reviewer would hit a login wall.

## Screenshots — 1280×800, at least one, up to five

Take these against a shelf with **real** books you actually saved. A mocked shelf reads
as a mock.

1. **The shelf**, eight to twelve books across Now / Next / Someday, covers visible. This
   is the one that sells it — lead with it.
2. **A catch in progress** on a real post: the picker open beside a cover image.
3. **The book icon** in a post's action bar, so people see where it lives.
4. **The masthead stat** (`23 caught · 87% kept`) — nothing else in this category shows
   you its own accuracy.

## Promotional tile — 440×280

The mark on a `#F4F2FB` ground, wordmark to the right, one line beneath:
"Catch books before you forget them."
