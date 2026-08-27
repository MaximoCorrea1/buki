# Project-wide agent instructions — Buki

## What this file is, and what it is not

**Three things only.** THE RULES an agent must follow, THE GROUND TRUTH it cannot derive,
and THE POINTERS to everything else.

**The test for anything here: does an agent need it on TURN ONE of every session?** A rule
does. What Buki is and where it stands does. **The STORY BEHIND a rule does not** — that
lives in `OPENWORK.md` §5, which is the case ledger with every measurement and its probe.

⚠ **THE ONE EXCEPTION, AND IT IS MEASURED.** §5 spans `OPENWORK.md` lines **2063–2717**,
and the Read tool takes **2000 lines by default**. This paragraph used to say *"only the
first ~100 lines of §5 are reachable"*. **That stopped being true on 2026-08-27: §5 now
BEGINS at 2063, so NONE of it is reachable by a default Read** — the whole case ledger,
including every trap that has already cost this project time. On the morning of 08-27 the
four below the cut were `heredoc`, `backtick`, `npx` and `0x08`, **the exact four that were
hit five times in one session**; the same day, the backtick trap was hit a sixth time. A
rule nobody can read is not a rule. **That is why the shell traps are spelled out below
instead of pointed at, and it is why §5 needs extracting rather than trimming.**

⚠ **SIZE BUDGET, AND IT MOVED AGAIN.** `OPENWORK.md` is **~215,700 chars / 2,751 lines**,
up from 196,000 / 2,545 on 2026-08-27 morning. **§5 now starts 63 lines FURTHER past the
2000-line Read cut than when this warning was written**, and §6 is 718 lines beyond it. The
numbers in this paragraph are the thing most likely to be stale, so re-measure them
(`wc -l -c OPENWORK.md`, `grep -n '^## ' OPENWORK.md`) rather than trusting them. **Read it with an
explicit `offset`/`limit` or by section, never as one call**, or you silently lose §6 and
most of §5. Keep THIS file small enough to survive any cut — if it grows past ~15k chars,
move the cases to §5 and leave the law behind.

---

## The bar

You are the senior engineer AND the senior designer here, and they are one job.

- **Engineering.** A claim without a probe is an opinion. **A guard never watched to FAIL
  is not evidence** — that is this repo's signature discipline and it has found four real
  holes in tests written minutes earlier.
- **Design.** Apple's restraint, German precision about what a thing IS, and a willingness
  to delete a part rather than improve it. Hierarchy is size and weight, **never a fade**.
  The best fix is usually a removal.
- **Cost.** Name the growth class before the number. One picture can hold **20 books**
  (`MAX_BOOKS`), so anything per-book is `O(books)` and a bare `Promise.all` over it opened
  19 sockets and earned an HTTP 429. A catch costs about **$0.00011**; the Gemini cap is
  **$5**.
- **Business.** **Buki is pre-launch with zero users.** No testimonials, no counts, no
  ratings — the positioning doc forbids inventing one. An engineering win that does not
  move launch, trust or discovery is a win about the wrong axis. Say so.

**Two things here are IRREVERSIBLE and everything else is not:**

1. **Store copy cannot be edited after submission** without another review cycle. The
   summary, the description, the single-purpose statement, the screenshots. Changing one
   today costs a line; changing it in September costs a re-review.
2. **A published extension's id is fixed.** It comes from a hash of the public key, so the
   id you see unpacked is **not** the id customers get. Item 37.

**Be honest at the size the founder can act on.** Lead with the number and the probe. Name
what you did NOT check. A confident wrong argument gets written down and inherited.

---

## Session start — in order

| # | do this | it settles |
|---|---|---|
| **1** | finish reading THIS file | the rules and the ground truth |
| **2** | **`OPENWORK.md` → THE LANE** (read by section, not whole) | what is open, who owns it, in what order. **The only authority on status** |
| **3** | the newest handoff in **`%TEMP%/buki-handoff-*.md`** | where the last cycle stopped and what it BELIEVED |
| **4** | **create this session's two ledgers and PRINT BOTH PATHS** | `docs/SESSION-CONTEXT-<date>-<label>.md` + `docs/SESSION-TODO-<date>-<label>.md`, **before the first substantive tool call**. Written late five sessions running |
| **5** | **run the three probes** | what the SYSTEM says, as opposed to what the docs believe |

```
./node_modules/.bin/vitest run
node node_modules/typescript/bin/tsc --noEmit
node build.mjs
```

**And the two that catch doc drift:**

```
git rev-list --count origin/main..HEAD
grep -o '^| \*\*[0-9]*\*\*' OPENWORK.md | grep -o '[0-9]*' | sort -n
grep -o '^- \[ \] \*\*[0-9]*'  OPENWORK.md | grep -o '[0-9]*' | sort -n
```

**The last two lists must be identical.** LANE rows and item bodies drifted apart on
2026-08-27 and the header's open count was wrong for half a day. §5 T9.

**On demand, not at start:** `OPENWORK.md` §0 (which doc owns which fact — **read it before
hunting for a file**) · `docs/brand.md` (voice, locked copy, the visual contract) ·
`.agents/product-marketing.md` (positioning, objections, the word list) · `docs/store/`
(everything the listing needs) · `docs/REVIEW-2026-08-24-prelaunch.md` (**its §0.0 STATUS
first**, so you do not re-audit what is closed) · `docs/superpowers/specs|plans/`.

---

## The live task list

⚠ **The tasks do NOT live in this file.** One fact, one home: they live in **your
`docs/SESSION-TODO-<date>-<label>.md`, in a `## TASKS` table at the TOP.**

What this file mandates is that the list is **VISIBLE**, because the founder cannot see a
file you have not shown them. **Print a compact task table at four moments and only these:**

1. Your first reply of the session, under the two ledger paths.
2. **Whenever a task closes** — the whole table, so open and closed are both visible. Never
   just "done"; "done" hides what is still open.
3. **The moment a NEW task appears.**
4. Whenever the founder asks anything about status.

```
[x] done+verified   [~] in progress   [ ] open   [?] founder decision   [!] blocked
```

⭐ **A NEW TASK IS THE ONE THAT GETS LOST**, because it arrives mid-flight while you are
holding something else. **CAPTURE, THEN CONTINUE. Never continue, then capture.** Append
the row and the detail in the same turn it was said. That includes asides and anything the
founder mentions in passing.

---

## ⛔ THE SHELL, and it has cost more time than any bug

Windows + Git Bash. **These are spelled out here rather than pointed at, because in
`OPENWORK.md` they sit below the Read cut.**

- **`npm run` and `npx` both FAIL.** Use `./node_modules/.bin/vitest run` and
  `node node_modules/typescript/bin/tsc --noEmit`.
- **A large heredoc breaks on quoting**, and bash then never runs the command, so the next
  step reports success against an unchanged file. **Over ~20 lines: write content with the
  Write tool, apply it with `node <file>.mjs`, and guard every replacement** so a miss is
  loud (`if (!text.includes(from)) { console.error(...); process.exit(1) }`).
- **A BACKTICK inside a template literal terminates it.** `String.raw` does not help. It has
  landed in a CSS-in-JS block in `content.ts` where it surfaced as
  `Property 'buki' does not exist`. **SIX occurrences on 2026-08-27, and the sixth was inside the `node -e` that was mutation-testing this very warning.**
- **`node -e "…\s…"` inside DOUBLE quotes**: bash eats one backslash level, so `\s` becomes
  `s` and `\b` becomes a literal **0x08 backspace byte** that markdown renders as nothing.
  **Single-quote the `-e` body, or use the Write tool.**
- **`execSync` from a node script runs under cmd.exe**, which cannot resolve `node` because
  the inherited PATH is Unix-form. Build the command from `process.execPath`.
- **When parsing vitest output, strip the ESC BYTE:** `/\x1b\[[0-9;]*m/g`. Stripping only
  `[32m` leaves `\x1b`, `\s` does not match it, and **every mutation reports SURVIVED
  against a harness that read nothing.**

**When mutation-testing, compare the TOTAL, not the failure count.** A mutation that does
not compile makes the file fail to LOAD, so vitest reports a *smaller* all-green total —
which reads as "survived" and is exactly backwards. **Make the harness ABORT when it cannot
parse a total rather than scoring it zero.**

---

## Ground truth an agent cannot derive

- **Buki catches books from pictures into a shelf in your browser.** MV3 extension, a
  Vercel edge proxy, no database, no account. `README.md` owns what it does today.
- **Pre-launch.** The chain now starts at **item 37**, the draft upload, because the real
  extension id gates both endpoints.
- **`docs/` is the public Vercel site root.** Anything added there that is not a page goes
  in `.vercelignore` **in the same commit**. `SESSION-*`, `REVIEW-*`, `store/` and
  `superpowers/` are already covered.
- **Handoffs go to `%TEMP%`, never the repo.** Use forward slashes when writing the path
  into a doc — a `\b` was consumed as an escape once and shipped a raw `0x08`.
- **There is no `docs/adr/`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/handoffs/` or
  `docs/retros/`.** `OPENWORK.md` §0 lists them as deliberately absent. **Do not create
  them.** The permanent index is `OPENWORK.md`, not `docs/OPEN-WORK.md`.
- **`zzz-*` is gitignored** (scratch and harness output). Screenshots are **not** — check
  `git status` before `git add -A`.
- **Four files no test can import**: `background.ts`, `content.ts`, `popup.ts`,
  `options.ts`. Put every DECISION in an importable module and leave wiring behind, or it
  is untestable at birth. Precedent: `saveBook.ts`, `activateKey.ts`, `manualAdd.ts`.
- **A `?raw` source guard cannot see control flow.** Write it as an ABSENCE proof — *there
  is no second way in* — never as *the safe call is present somewhere*, which **a comment
  satisfies**. `contentSafety.test.ts` is the worked example.

**Voice, from `docs/brand.md`:** no em-dashes in user-facing copy · sentence case · active
voice · errors name what failed and never apologise · an empty state is an invitation.
**Never** *organise*, *manage*, *seamless*, *game-changing*, or *scan*. **`AI-powered` is
banned as a claim; `AI` is allowed as a fact** — if the sentence survives deleting the word
and still says something, it is a fact.

---

## Subagents

**Do not dispatch one unless the founder asks.** That is a standing instruction for this
project, not a preference.

**When they do ask**, a worker prompt must carry all five: the task, the concrete file
paths, the skill to invoke, the verify command, and — verbatim — *"DO NOT TRUST THE PLAN
BLINDLY. VERIFY every empirical claim it makes before relying on it, and if the plan is
wrong, fix the plan text as well as the code and say so."* Subagents do not inherit the
routing hook, so carry the skill and the gate explicitly.

**Commit each task before the next**, never one giant end-of-session commit. Commit
messages here carry their own reasoning — that is the only reason two undocumented days
were reconstructable on 2026-08-27.
