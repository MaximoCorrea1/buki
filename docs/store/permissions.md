# Permission justifications

> ## ⚠ STALE, and this is the file that fails review. Rewrite is OPENWORK item 17.
>
> **Two of the three permissions below are no longer hypothetical.** `scripting` and
> `activeTab` shipped in the manifest on 2026-08-12 with catch-anywhere, and neither is
> justified anywhere in this file. A reviewer comparing the manifest against this document
> is exactly who it is for.
>
> | Permission | Why it is needed | What breaks without it |
> | --- | --- | --- |
> | `scripting` | Inject the catch tray into a tab that has no content script | Catching a book anywhere except X shows no feedback at all |
> | `activeTab` | The grant a context-menu click gives, which makes that injection legal without host access at install | Injection needs a broad host permission instead, which is a worse ask |
> | `https://*/*` (declared **optional**) | Fetch a cover from a CDN that is not the tab's own origin, requested per host on first use | Off X, the picture cannot be read at all |
>
> **The narrowest honest framing is the one to use:** `activeTab` plus an optional host
> permission requested on first use, not a broad host permission at install. Say that
> explicitly.
>
> **"Nothing is transmitted" below becomes false the day the proxy ships.** An inaccurate
> data-usage declaration is one of the most reliable ways to fail review, and it would be a
> lie in the section reviewers read most carefully. Re-check the existing answers end to
> end too: they predate cover caching in the Cache API and the caught picture being stored
> as a book's cover.
>
> Cannot be finished before the proxy exists: see `OPENWORK.md` Part 1.

Paste each into the matching field on the Web Store **Privacy practices** tab. Reviewers
reject vague answers, so each one names the feature that needs it.

## Permissions

**storage**

```
Stores the user's reading list, their recognition settings, and a local diagnostic log,
all in chrome.storage.local on their own machine. Nothing is transmitted.
```

**contextMenus**

```
Adds a "Save book to shelf" item to the right-click menu on images. This is the primary
way a user saves a book they have seen as a photo rather than as a link.
```

## Host permissions

**https://twitter.com/\*, https://x.com/\***

```
Buki only operates on these sites. The content script injects the save button into a
post's action bar, reads the text and links of the post the user acted on, and displays
the result. It is deliberately scoped to these hosts: elsewhere there is no content
script, so a save would silently change the user's shelf with no visible feedback.
```

**https://pbs.twimg.com/\***

```
Book cover images on X are served from this host. The extension needs to reference the
image the user explicitly asked to identify so it can be sent to their recognition
provider.
```

**https://openlibrary.org/\*, https://covers.openlibrary.org/\***

```
Recognized titles are checked against the OpenLibrary API to obtain a canonical title,
author, ISBN, and cover image. This is what prevents a misread cover from being saved as
a book that does not exist.
```

**https://generativelanguage.googleapis.com/\***

```
The default vision model that reads a book cover from a photograph. The user supplies
their own API key, and the request contains only the image and the post's text. The user
may point the extension at any other OpenAI-compatible endpoint instead.
```

## Are you using remote code?

```
No. All logic is included in the extension package. No scripts are fetched or evaluated
at runtime.
```

## Data usage

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
