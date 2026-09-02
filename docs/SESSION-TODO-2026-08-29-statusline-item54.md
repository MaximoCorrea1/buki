# SESSION TODO — 2026-08-29, the status line + item 54 lane

Pair file: `docs/SESSION-CONTEXT-2026-08-29-statusline-item54.md`
Inherited from: `%TEMP%/buki-handoff-2026-08-28-covers-passages.md`, `origin/main` at `3d643a4`.

`[x]` done+verified · `[~]` in progress · `[ ]` open · `[?]` founder decision · `[!]` blocked

## TASKS

| # | task | state | owner | note |
|---|---|---|---|---|
| **S1** | Status line gauge renders nothing | `[x]` | agent | Root cause proven; gauge renders end to end |
| **S2** | `augmentPath` tests presence, not reachability | `[x]` | agent | Fixed. 105/105, red watched first |
| **S3** | Remove the stray quote from the machine's PATH | `[?]` | Maximo | Registry change. Restores 76 entries incl. system32 |
| **S4** | Correct the mechanism recorded for this failure class | `[x]` | agent | `CLAUDE.md:152` said "PATH is Unix-form". Disproved and rewritten |
| **S5** | Two instruments disagree about this session's context | `[ ]` | agent | Hook says 78% / 780,316; sensor says 13% / 125,195, seconds apart |
| **L1** | ⭐ Cover lands VISIBLY LATER than the book | `[x]` | agent | Cannot be made faster: **2,140ms median, repeat no faster**. Photograph now draws in the same paint |
| **L2a** | Original image as fallback, **toast** | `[x]` | agent | `thumbPlan`, 8 mutations. One book + one picture only — see note |
| **L2b** | Original image as fallback, **shelf** | `[x]` | agent | Already did: `coverSources` walks `[coverUrl, shot]` before the board. Verified, unchanged |
| **L2c** | "when it goes to the shelf try again, maybe it finds" | `[~]` | agent | Retries per shelf OPEN now, not per keystroke. **Re-SEARCHING for art is a separate cost decision — see L5** |
| **L3** | ⭐ Is the shelf efficient? | `[x]` | agent | Audited; two real defects found and fixed. Answers in the CONTEXT ledger |
| **L5** | ⭐ Re-search OpenLibrary for art a book never had? | `[?]` | **Maximo** | N artless books × 1 search per shelf open, at the host that 429'd. Needs a throttle and a budget |
| **L7** | ⭐ **CROP the book out of the photo and use it as the cover** | `[?]` | **Maximo** | Founder 09-02. **Not overengineering — it retires item 60 and both photo refusals.** Both APIs verified. Blocked on ONE unmeasured thing: box accuracy on real photos, which needs the Gemini key |
| **L8** | Cheap middle: let a multi-book catch show the shared photo | `[?]` | **Maximo** | One line. Trades item 60's repetition for "not a colour". Reverses the `books === 1` rule in `thumbPlan` |
| **L9** | Option C — a second cover source | `[x]` | agent | **Tested and REJECTED on licence.** `docs/SESSION-CONTEXT-2026-09-01-covers.md`. Do not re-run |
| **L6** | Item 56 — cover CORS chain | `[x]` | agent | **CLOSED by probe.** Every hop usable; the origin is reflected back |
| **56** | (was Maximo's) | `[x]` | agent | Struck in LANE and body 09-01 |
| **L4** | Gemini billing | `[~]` | **Maximo** | Founder 09-01: *"im managing the gemini billing"*. Unblocks part of item 2 |
| **A1** | No cover art → the original image | `[x]` | agent | `cae4ad1` · 7/7. **L2 is the FAILURE case, which A1 did not cover** |
| **A2 / 60** | Artless books from one photo share a tile | `[?]` | Maximo | Filed by the commit that caused it |
| **B1–B2** | Passages: probe + design | `[x]` | agent | `bd2fa38` · scoping works, 5/5 discriminate |
| **B4 / 57** | ⭐ Does the promise survive "books old enough to be in the open library"? | `[?]` | Maximo | Owner. Coverage is the ceiling, not ranking |
| **E1–E9** | ⭐ Item 51 — all nine | `[x]` | agent | 81 mutations |
| **H1–H2** | ⭐ Item 52 — both named findings | `[x]` | agent | 16 mutations |
| **H3–H7** | ⭐ Item 53 — all five | `[x]` | agent | 22 mutations |
| **D1–D7** | Seven traps found and recorded | `[x]` | agent | §5 T20–T22 |
| **G1 / 54** | **Item 54 — dead code, stale comments, one edge vs the graph** | `[~]` | agent | Split below; **5 of 10 closed** |
| G1·M-1 | `host.ts` exports two endpoints nothing imports | `[x]` | agent | 3 callers now import; absence proof added, watched to fail |
| G1·M-2 | `tools/mark-sizes.mjs` is 100% dead | `[x]` | agent | Drew the mark retired 08-17. Rewritten on `markSvg`; guard now RUNS it |
| G1·M-3 | `tray-harness.mjs` hand-spells the mark (8th copy) | `[x]` | agent | Now imports `markSvg`; the copy is deleted, not asserted about |
| G1·X-2 | `entitlement.footer()` has no caller | `[x]` | agent | Superseded by `badgeFor`, not merely dead. Deleted + 5 comments. **Filed item 62** |
| **S6 / 62** | ⭐ Should the TRAY carry the quiet countdown line? | `[?]` | **Maximo** | Designed, argued for, never wired. Doing nothing is a real option |
| **S7** | `zzz-tray-harness.html` repeats gradient ids `h1–h4` ten times each | `[ ]` | agent | Pre-existing, not from this lane. Invalid HTML; visually harmless because the duplicates are identical and nothing is removed |
| G1·X-5 | `Tweet.altText` declared in 3 files, never populated | `[ ]` | agent | Not yet re-probed |
| G1·X-6 | Nine dead CSS tokens, five a 4th copy of `BINDING` | `[ ]` | agent | Not yet re-probed |
| G1·D-5 | `toolbar.ts` hardcodes two brand colours | `[ ]` | agent | Not yet re-probed |
| G1·D-7 | `bindingFor` indexes `BINDING` by `CLOTH.length` | `[ ]` | agent | Fails silently on the sixth dye |
| G1·D-9 | `tray-harness.mjs` drops a dye; marigold invisible | `[x]` | agent | Palette now read from `cloth.ts`; marigold 0 → 50 occurrences |
| G1·K-1 | `src/recognizer/` imports `src/extension/` | `[ ]` | agent | Documented as deliberate; may be a no-op |
| G1·SC | Five stale comments | `[ ]` | agent | `README.md:103` was one — now corrected |
| **G2 / 55** | Item 55 — the two surfaces no test can reach (M-5, M-6) | `[ ]` | agent | |
| **G3 / 50** | Item 50's remainder — PERF-2 tray memo, PERF-8, PERF-10 | `[ ]` | agent | PERF-3 is a founder call |
| **G4 / 61** | Item 61 — the tray shadow root | `[ ]` | agent | Needs a browser + the 110-selector split first |
| **G5** | `applyCover` double-fetch | `[ ]` | agent | Unmeasurable from node |
| **G6 / 36** | Item 36 — launch day | `[ ]` | agent | |
| **F1–F6** | Items 57, 58, 59, 60, PERF-3, the §5 extraction | `[?]` | Maximo | Six decisions. §5 extraction is the oldest open problem |
| **M1–M5** | Launch chain: 37 → 2 → 3, plus 9, 35, 56 | `[ ]` | Maximo | 37 heads it; nothing an agent does moves it |

---

## S1 — the status line gauge renders nothing

**Symptom.** Founder: *"the status line gauge is not rendering"*. The whole status line is
blank, not just the gauge.

**Chain.** `statusLine.command` → `bin/sensor.js` → `spawnSync(SCW_WRAPPED_STATUSLINE,
{shell:true})` → cmd.exe → `node statusline.js` → the gauge.

**Boundary evidence, gathered before any fix:**

| Boundary | Probe | Result |
|---|---|---|
| L1 Claude Code → sensor env | `echo $SCW_WRAPPED_STATUSLINE` in a CC child | **present** |
| L1b Claude Code → sensor runs? | snapshot mtime vs `date -u` | **written seconds ago** — sensor runs every render |
| L1c stdin carries `context_window`? | the snapshot's own content | `usedPct: 13`, `windowSize: 1000000` |
| L2 sensor → cmd.exe | `spawnSync(wrapped, {shell:true})` | `status=1`, stdout empty |
| L2b what cmd said | `result.stderr` | `"node" no se reconoce como un comando interno o externo` |
| L4 the gauge itself | direct spawn, **no shell** | `Smart ██░░░░░░░░░░░░ 13%` — **works** |

**Root cause.** The machine's `PATH` carries one unbalanced double-quote:

```
entry [13] = C:\Program Files\Java\jdk-21\bin"
```

cmd.exe's path search treats everything from that quote onward as a single quoted token, so
**entries 13–88 are unreachable**. `C:\Program Files\nodejs` is entry **39**;
`C:\Windows\system32` is entry **19**. `SCW_WRAPPED_STATUSLINE` invokes a bare `node`, cmd
cannot resolve it, `spawnSync` returns empty stdout, and `sensor.js` writes only stdout — so
the line renders blank.

**Proven with a control and two mutations** (`scratchpad/probe-confirm.mjs`):

| PATH variant | `node -v` via cmd.exe |
|---|---|
| original, quote intact | **FAIL** |
| quote stripped from every entry | PASS `v20.16.0` |
| runtimeDir prepended, quote intact | PASS |
| entries before the quote + runtimeDir | PASS |
| runtimeDir **then** poison | PASS |
| poison **then** runtimeDir | **FAIL** |

The last pair is the one that matters: the quote is the agent, and only entries *after* it die.

**Loose end, closed.** `hostname` resolved while `where` did not. `where.exe` lives only in
system32 (entry 19, after the poison); Git ships `hostname.exe` in `usr\bin` at entry ~3,
before it. The model is consistent.

## S2 — `augmentPath` tests presence, not reachability

`src/passthrough.js` exists to stop exactly this failure. It did not, because:

```js
const alreadyPresent = current.split(delim).some((entry) => entry === runtimeDir);
if (!alreadyPresent) next[key] = `${runtimeDir}${delim}${current}`;
```

`runtimeDir` **was** present — at index 39, behind the poison. Present, and unreachable. So the
guard declined to prepend, and the thing it was written to prevent happened anyway.

This is the same class as `?raw` guards that cannot see control flow, and as
`maintaining-project-docs` Rule 2's presence-vs-distribution axis: **the cheap measurement was
not the one that mattered.**

## S3 — the machine's PATH (founder decision)

Removing the stray quote restores 76 PATH entries, **including system32**, for every tool on
this box that shells out through cmd.exe — not just the status line. That is the larger bug.
It is a change to the user environment, so it is the founder's call, and it needs a new
process to take effect.

## S5 — two instruments disagree about this session

`UserPromptSubmit` reported `Context: 78% used, 780,316 of 1,000,000`. The sensor snapshot
written seconds later reports `totalInputTokens: 125195, usedPct: 13`. Same session, same
minute, a 6x gap. One of them is being read at the wrong moment (most likely the hook is
reporting the pre-compaction figure). Worth settling, because the founder reads that line.
