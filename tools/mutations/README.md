# Mutation plans — the record of what was actually broken on purpose

**A guard never watched to FAIL is not evidence.** That is this repo's signature discipline
and `OPENWORK.md` §5 records four separate occasions where it found a real hole in a test
written minutes earlier. These files are what was mutated, per item, so the claim
*"N mutations, N caught"* in a commit message can be re-run rather than believed.

```
node tools/mutate.mjs tools/mutations/item-47.json
```

From the **repo root**. Every path inside a plan is repo-relative.

## What each plan covers

| Plan | Item | What it breaks |
| --- | --- | --- |
| `item-45.json` | 45 | The price guard: drift on each surface, the vacuous pass, the exclusion, the heading rename |
| `item-45b.json` | 45 | The exclusion audit — excluding a real page, and excluding nothing |
| `item-46-tm8.json` | 46 | CSV formula injection, including both half-fixes and the ISBN shape |
| `item-46-guards.json` | 46 | The manifest permission surface and the store paste block |
| `item-46-tm11.json` | 46 | The Forget control, and the absence proof's discrimination in both directions |
| `item-47.json` | 47 | ADV-6 / C-5 / C-6 — **including the review's own prescribed fix, applied verbatim** |
| `item-47b.json` | 47 | C-7 and C-9 |
| `item-47c.json` | 47 | C-8, the prune inside the undo window |
| `item-48.json` | 48 | ADV-3 and ADV-8 |
| `item-49a.json` | 49 | R-1 and R-4, the unbounded awaits on the catch path |
| `item-49b.json` | 49 | R-2's persisted cooldown and R-3's watchdog |
| `item-50a.json` | 50 | The `groundText` fan-out and the cover cache write |
| `item-50b.json` | 50 | The indexed shelf lookup, against the scan it replaced |
| `item-50c.json` | 50 | The `weaveOf` memo and the keystroke path |

## Three rules the harness encodes, and why

Each one is a §5 trap that made a PREVIOUS harness lie:

- **Strip the ESC byte**, `/\x1b\[[0-9;]*m/g`. `/\[[0-9;]*m/` leaves `\x1b` behind, `\s`
  does not match it, and **every mutation reports SURVIVED against a harness that read
  nothing**.
- **Compare the TOTAL, not the failure count.** A mutation that does not compile makes the
  file fail to LOAD, so vitest reports a *smaller* all-green total — which reads as
  "survived" and is exactly backwards. The harness calls that **INVALID**, and it fired for
  real on `item-50a`.
- **ABORT when a total cannot be parsed, or when a `from` pattern is not found.** Scoring
  either as zero is how a harness that read nothing reports a clean sweep. The
  pattern-not-found abort is what surfaced a literal NUL byte in a source file on
  2026-08-27 (§5 T19).

## Two things that are NOT bugs

- **An INVALID verdict means your mutation did not compile**, not that the guard failed.
  Rewrite the mutation so the file still parses.
- **An EQUIVALENT mutant is a signal to simplify.** `item-48` originally carried one:
  `!renewing && !claim.activationId`, where `renewing` implies `claim.activationId` by
  construction. It could not be caught because it could not change the outcome. The answer
  was to delete the condition, not to invent a test that cannot fail. §5 T15.
