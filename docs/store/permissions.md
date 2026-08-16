# Permission justifications

> ## ⚠ Half of this file is ready. The Data usage section is NOT.
>
> **Rewritten 2026-08-16.** Every permission in the manifest is now justified here, and the
> `activeTab` framing a reviewer will look for is stated explicitly. That half is
> paste-ready.
>
> **What still waits on the proxy (`OPENWORK.md` Part 1, plan Task 6):** the
> [Data usage](#data-usage) section, and the `generativelanguage.googleapis.com`
> justification. Both describe a world where the picture goes straight from the user's
> machine to the provider they configured. The day `/api/vision` ships, it goes to Buki
> first, and **an inaccurate data-usage declaration is one of the most reliable ways to
> fail review.** Do not submit until that section is rewritten in the same commit as the
> proxy.
>
> This split is deliberate. The permission answers do not depend on the proxy, and holding
> them hostage to it was treating one blocked item as one blocked lump.

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

**https://twitter.com/\*, https://x.com/\***

```
On x.com and twitter.com, Buki's content script adds a book icon to a post's action bar
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

> **⚠ This answer changes with the proxy.** Today the default endpoint is Google's and the
> user brings their own key. When `/api/vision` ships, the default becomes Buki's own host
> and this block, plus Data usage below, has to say so.

```
The default vision model that reads a book cover from a photograph. The user supplies
their own API key on the setup page. The request contains only the image the user asked
Buki to identify and, on x.com, the text of the post it came from. The user may point
Buki at any other OpenAI-compatible endpoint instead, and Buki works without a key at all
for books identified from a retailer link or from a post's own words.
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

> ## ⚠ DO NOT SUBMIT THIS SECTION AS WRITTEN. It becomes false the day the proxy ships.
>
> The answers below describe the picture travelling from the user's machine to the
> provider **they** configured, with no Buki server in between. `OPENWORK.md` items 1, 2
> and 10 change that: `/api/vision` receives the image first. Rewrite this section, the
> `generativelanguage` block above, `docs/privacy.html` and the landing's "Your shelf never
> leaves your computer" section **in the same commit as the proxy**, and state what the
> server receives, what it keeps, and for how long.
>
> Everything above this line is current and can be pasted today.

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

Website content explanation:

```
Limited to the image and post text the user explicitly asks Buki to identify, sent to
the user's configured recognition provider and to OpenLibrary solely to identify the
book. Not stored on any server, not sold, not used for advertising, and not used to
determine creditworthiness or for lending.
```

Then confirm all three certification checkboxes:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

## Note on the affiliate link

Chrome Web Store policy allows affiliate links, but requires them to be disclosed and to
provide genuine user benefit. Buki's Buy link is disclosed in three places: the popup
footer, the options page, and the privacy policy. It appears only on books the user has
already saved and never alters what the extension shows. Do not remove any of those three
disclosures.
