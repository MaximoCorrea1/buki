# Permission justifications

> ## Ready to submit, as of 2026-08-18.
>
> **Rewritten 2026-08-16**, when every permission in the manifest was justified here and the
> `activeTab` framing a reviewer looks for was stated explicitly. **Finished 2026-08-18**,
> when the proxy's own host permission, the `generativelanguage` answer and the
> [Data usage](#data-usage) section were rewritten to describe the world the proxy actually
> creates: the picture goes to Buki first unless the user brought their own key.
>
> **An inaccurate data-usage declaration is one of the most reliable ways to fail review**,
> which is why that section was held back rather than guessed at. It is now written against
> the code: `visionRoute.ts` decides where a picture goes, `visionHandler.ts` decides what
> the server does with it, and neither stores it.
>
> Rewritten in the same pass: `docs/privacy.html` and `README.md`. The landing's data
> section was already correct.
>
> **One thing still gates submission and it is not this file:** items 1, 2 and 26. Nothing
> here can be verified by a reviewer until the endpoints answer.

Paste each block into the matching field on the Web Store **Privacy practices** tab.
Reviewers reject vague answers, so each one names the feature that needs it and says what
breaks without it.

**The framing to keep, because it is the answer to the question a reviewer is actually
asking:** Buki uses `activeTab` plus **one optional host permission requested on first
use**, not a broad host permission at install. It never holds access to a site the user has
not right-clicked an image on.

## Permissions

**storage**

```
Stores the user's reading list, which pile each book is in, their recognition settings,
and a local diagnostic log of the last 200 recognition attempts. All of it lives in
chrome.storage.local on the user's own machine, and none of it is transmitted anywhere.

Cover images are deliberately not kept here. They go in the browser's Cache API, bounded
by what is on the shelf, so that a shelf of covers cannot consume the storage quota and
so that Buki does not have to ask for unlimitedStorage.
```

**contextMenus**

```
Adds a "Save book to shelf" item to the right-click menu on images. This is the primary
way a user saves a book they have seen as a photograph rather than as a link.
```

**scripting**

```
Shows the user the result of a catch on pages that have no Buki content script.

The content script is declared for x.com and twitter.com only. When the user right-clicks
a cover anywhere else, chrome.scripting.executeScript injects the same result card into
that one tab, so they can see which book was found, how it was identified, and choose
which pile it goes in.

Without this, a save outside x.com would change the user's shelf with no visible feedback
at all. That is exactly why the feature was restricted to one site before this permission
existed.
```

**activeTab**

```
Grants the access that the injection above needs, for one tab, and only because the user
clicked Buki's own item in that tab's right-click menu.

This is what lets Buki show a result card on any site without holding a host permission
for every site at install time. The grant is limited to the tab the user acted on and to
that interaction. Buki requests no broad host permission to make this work.
```

## Host permissions

> ### PASTE THIS ONE. 953 characters.
>
> **The dashboard gives host permissions ONE justification field with a 1000-character
> limit, not one field per host.** The five blocks below total 2,669 characters and will
> not fit. They stay, because each is the honest long answer if a reviewer asks about a
> specific host, and because they are where the reasoning lives.
>
> Measured, not estimated: 953 characters with LF endings, 965 if the field counts CRLF.
> Both clear 1000 with room, and the room is deliberate - a justification trimmed in the
> browser gets trimmed at the END, and the end is where the wildcard answer lives.

```
Buki identifies books in pictures and saves them to a list in the user's browser.

x.com, twitter.com: Buki's button sits in a post's action bar and reads that post's text and links. A caption or retailer link often identifies a book an unreadable cover cannot.

pbs.twimg.com: where x.com serves cover images; only the right-clicked one is fetched.

openlibrary.org, covers.openlibrary.org: recognised titles are checked for canonical title, author, ISBN and cover, so a misread is not saved as a real book.

generativelanguage.googleapis.com: the vision model, used only when the user supplied their own key.

get-buki.vercel.app: the developer's own endpoints. One reads a cover for users with no key; one exchanges a licence key for a short-lived pass.

The optional https://*/* is never granted at install: Buki requests one host at a time, derived from the right-clicked image's own URL, because covers usually sit on a CDN activeTab cannot reach.
```

**What survived the cut.** Every host keeps a reason a reviewer can check, and the optional
wildcard keeps ALL THREE of its clauses: never granted at install, requested one host at a
time, and derived from the right-clicked image's own URL. That third clause is the whole
defence - it is the difference between *this extension wants every site* and *this extension
asks for one image host when you right-click an image on it*. **If this ever has to be
shortened again, cut a named host, never that sentence.**

**What went**, and nothing load-bearing did: the intro's duplication of the Single Purpose
field sitting directly above it in the form, the word "OpenLibrary" repeated beside the
openlibrary.org hostname, and "used only when the user has supplied their own API key" down
to "their own key".

---


**https://twitter.com/\*, https://x.com/\***

```
On x.com and twitter.com, Buki's content script adds its own button to a post's action bar
and reads the text and links of the post the user acted on. That text is sent together
with the cover image, because the caption is often what makes an unreadable cover
legible, and a retailer link in the post identifies the book outright with no image
reading at all.

Buki catches books on other sites too and does not use this permission to do so. Off
these two hosts there is no content script, the result card is injected on demand under
activeTab, and the picture is the only signal available.
```

**https://pbs.twimg.com/\***

```
Book cover images on x.com are served from this host. Buki fetches the one image the user
explicitly right-clicked so it can be sent for identification.

It is declared here rather than requested at run time so that catching a book on x.com,
the case Buki was built for, never interrupts the user with a permission prompt.
```

**https://openlibrary.org/\*, https://covers.openlibrary.org/\***

```
Recognized titles are checked against the OpenLibrary API to obtain a canonical title,
author, ISBN and cover image. This is what stops a misread cover being saved as a book
that does not exist, and it is what lets each catch tell the user how confident it is.

Cover image requests to covers.openlibrary.org redirect to archive.org. Buki holds no
permission for that host and needs none: every hop answers with permissive CORS.
```

**https://generativelanguage.googleapis.com/\***

```
The vision model that reads a book cover from a photograph, used when the user has
supplied their own API key on the setup page. The request contains only the image the
user asked Buki to identify and, on x.com, the text of the post it came from. The user
may point Buki at any other OpenAI-compatible endpoint instead.

Users who have not supplied a key do not reach this host at all: their request goes to
Buki's own endpoint below, which holds the credential. Buki also works with no key and
no subscription for books identified from a retailer link or from a post's own words.
```

**https://get-buki.vercel.app/\***

```
Buki's own two endpoints, and the only host in this list that belongs to the extension's
developer.

/api/vision reads a cover for users who have not supplied their own API key. The
extension holds no credential for the vision model, so the request is made by this
endpoint, which holds one. This is what makes the extension work with no setup.

/api/license exchanges the licence key a subscriber pastes into the setup page for a
short-lived pass, so the licence key itself is not sent with every cover reading.

Requested here rather than at run time because both are called by the extension's own
service worker, on the user's own action, and a permission prompt for the developer's
own backend would be asking the user to approve the extension working.
```

## Optional host permissions

**https://\*/\*, declared optional and never granted at install**

```
Requested one host at a time, at the moment the user right-clicks a cover that is served
from somewhere Buki does not already have access to. Book covers usually sit on a content
delivery network that is not the page's own origin, which activeTab does not cover, so
Buki has to fetch the image before it can be identified.

Buki derives the pattern from that image's own URL, so what is actually requested is a
single host such as https://images.example.com/*, never the wildcard the permission is
declared as. A URL that is not https, or whose hostname contains a wildcard character, is
refused rather than turned into a request. If the user declines the prompt, that catch
stops and nothing is saved.

This is the narrowest form of the ask available: activeTab for the tab the user acted on,
plus one host permission per image host, on first use. Buki does not request a broad host
permission at install and does not hold access to any site the user has not right-clicked
an image on.
```

## Are you using remote code?

```
No. All logic is included in the extension package. No scripts are fetched or evaluated
at runtime.
```

## Data usage

> **Rewritten 2026-08-18, against the code rather than against the plan.** The previous
> version described the picture travelling from the user's machine to the provider *they*
> configured with no Buki server in between, which `/api/vision` made false. What follows
> names both paths, because both exist and which one runs is the user's choice.

Tick **only** "Website content", and declare:

| Category | Answer |
| --- | --- |
| Personally identifiable information | Not collected |
| Health information | Not collected |
| Financial and payment information | Not collected |
| Authentication information | Not collected |
| Personal communications | Not collected |
| Location | Not collected |
| Web history | Not collected |
| User activity | Not collected |
| Website content | **Collected and transferred** |

**On "Authentication information": still Not collected, and that is not a technicality.**
There is no Buki account, no email address and no password. A subscriber pastes a licence
key issued by the payment provider; it is a receipt, not a credential tied to an identity.

**On "Financial and payment information": still Not collected.** Payment happens on the
payment provider's own pages. The extension never sees a card, and neither does the server.

Website content explanation:

```
Limited to the image and the surrounding post text that the user explicitly asks Buki to
identify, by pressing the Buki button on a post or using the right-click menu. Never in
the background and never for a page the user has not acted on.

Where it goes depends on one setting the user controls. If they have added their own
recognition API key, the image and text go directly from their browser to the provider
they configured, and Buki's own server is not in the path. If they have not, the image
and text are sent to Buki's endpoint at get-buki.vercel.app, which forwards them to
Google Gemini and returns the model's answer. That endpoint stores neither the image nor
the text: it holds no database, which is also why the extension has no account.

The recognized title and author are then sent to openlibrary.org as a search query, to
confirm the book exists and fetch its cover.

Not sold, not used for advertising, not used to determine creditworthiness or for
lending, and not used for any purpose beyond identifying the book the user asked about.
```

Then confirm all three certification checkboxes:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**What the server holds, stated here so the answer is the same wherever it is asked.**
Nothing is written to disk and there is no database. Two things sit in the server
instance's memory and vanish when it recycles: the caller's IP address with a count beside
it, which is how the free readings are counted, and a scrambled short form of a licence key
with a count beside it, which is how a leaked key is stopped from being used to exhaust its
own activations. The licence key itself is not kept. The same wording appears in
`docs/privacy.html`, and if the two ever disagree the code decides.

## Note on the affiliate link

Chrome Web Store policy allows affiliate links, but requires them to be disclosed and to
provide genuine user benefit. Buki's Buy link is disclosed in three places: the popup
footer, the options page, and the privacy policy. It appears only on books the user has
already saved and never alters what the extension shows. Do not remove any of those three
disclosures.
