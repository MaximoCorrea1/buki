# SESSION CONTEXT — 2026-08-29, the status line + item 54 lane

Pair file: `docs/SESSION-TODO-2026-08-29-statusline-item54.md`
Inherited: `origin/main` at `3d643a4`, 15 open items, LANE ≡ BODY, 1,160 tests / 88 files.

This file owns the REASONING: what was measured, with which probe, and which beliefs were
overturned. The task list lives in the TODO pair.

---

## What was asked

Founder, after a compaction: re-read the flows, re-read `frontend-design` and `emil-design-eng`,
re-read the lane (pasted in full), *"and get to work, the status line gauge is not rendering"*.

---

## Measurements, each with its probe

| # | Claim | Probe | Result |
|---|---|---|---|
| 1 | `SCW_WRAPPED_STATUSLINE` reaches Claude Code's children | `echo $SCW_...` in a Bash child | **present** |
| 2 | `sensor.js` is actually running every render | snapshot mtime vs `date -u` | written **seconds ago** |
| 3 | stdin carries `context_window` | the snapshot's own content | `usedPct: 13`, `windowSize: 1000000` |
| 4 | The gauge itself works | direct spawn, no shell | `Smart ██░░░░░░░░░░░░ 13%` |
| 5 | The shell hop fails | `spawnSync(wrapped, {shell:true})` | `status=1`, stdout empty |
| 6 | What cmd.exe said | `result.stderr` | `"node" no se reconoce...` |
| 7 | PATH cmd receives contains nodejs | `cmd /c echo %PATH%` | **yes**, at entry 39 |
| 8 | PATHEXT intact | env dump | `.COM;.EXE;...` — fine |
| 9 | system32 on PATH | env dump | **yes**, at entry 19 |
| 10 | PATH carries a stray quote | scan every entry for `"` | **1 occurrence, entry 13** |
| 11 | The quote is the agent | control + 5 treatments/mutations | see below |
| 12 | `augmentPath` unit suite before | `node --test test/` | 103 pass, 0 fail |
| 13 | The new tests fail first | `node --test test/passthrough.test.js` | **2 fail, 5 pass**, `RC=1` |
| 14 | The fix is green | `node --test test/` | **105 pass, 0 fail** |
| 15 | The real chain works | `bin/sensor.js < payload.json` | **69 bytes**, gauge, exit 0 |

### Measurement 11 in full — the control and the mutations

| PATH variant | `node -v` via cmd.exe |
|---|---|
| original, quote intact | **FAIL** |
| quote stripped from every entry | PASS `v20.16.0` |
| runtimeDir prepended, quote intact | PASS |
| entries before the quote + runtimeDir | PASS |
| runtimeDir **then** poison | PASS |
| poison **then** runtimeDir | **FAIL** |

The last pair is the one that carries the argument: position relative to the quote decides it,
so the quote is the agent and not a coincidence of ordering.

---

## Beliefs overturned

**1. "The Bash tool's sandbox is what breaks the shell hop."** Believed at the end of 08-28 and
told to the founder. **Disproved:** the same failure reproduces with the sandbox disabled. The
sandbox was never involved.

**2. "cmd.exe fails because the inherited PATH is Unix-form."** Written in `CLAUDE.md:152` and
inherited for weeks. **Disproved:** the PATH cmd.exe receives is Windows-form, 89 entries,
4,342 chars. Rewritten in place, keeping the surviving rule (build from `process.execPath`).

**3. "An absolute path also fails, so this is not a PATH problem."** Believed mid-session, from
`cmd /c "C:\Program Files\nodejs\node.exe" -v` failing. **Wrong, and it nearly sent me the wrong
way:** that failed on the SPACE, an ordinary quoting requirement. The short path
`C:\PROGRA~1\nodejs\node.exe -v` returned `v20.16.0`. A failing probe is not automatically
evidence for the hypothesis you were holding when you ran it.

**4. "`hostname` resolved, so the search is fine past entry 13."** Loose end that nearly
falsified the model. **Closed:** Git ships its own `hostname.exe` in `usr\bin` at index ~3,
before the poison. `where.exe` exists only in system32 at 19, after it, and did fail. Consistent.

---

## Instruments that lied, this session

| # | Instrument | What it actually measured |
|---|---|---|
| 1 | My own 08-28 conclusion | The sandbox. It was never the cause; I never ran the unsandboxed control |
| 2 | `cmd /c "<quoted abs path>"` | cmd's quote stripping, not whether absolute paths resolve |
| 3 | `augmentPath` itself | PRESENCE of the runtime dir, when only REACHABILITY matters |

Instrument 3 is the one worth carrying. The function exists solely to stop this failure, its
docblock says so, and it declined to act because the directory *was* on the PATH — present at
index 39, behind a quote at 13. **A guard that measures the cheap axis passes while the thing it
guards is broken.** Same family as `?raw` guards that cannot see control flow, and as
`maintaining-project-docs` Rule 2's presence-vs-distribution axis.

---

## The fix

`E:/Projects VS/session-context-window-api/src/passthrough.js`. Backup at `.bak-2026-08-29/`
(that repo is **not** under version control).

```js
// was: if the runtime dir is present anywhere, do nothing
const alreadyPresent = current.split(delim).some((entry) => entry === runtimeDir);
if (!alreadyPresent) next[key] = `${runtimeDir}${delim}${current}`;

// now: put it first, unconditionally, exactly once
const rest = current.split(delim).filter((entry) => entry !== runtimeDir);
next[key] = [runtimeDir, ...rest].join(delim);
```

Two tests added, both watched to FAIL first. The user's PATH is **not** rewritten: the poison is
left in place and the runtime is simply searched before it.

**What this does NOT fix.** Every other tool on this machine that shells out through cmd.exe
still loses entries 13 to 88, system32 among them. That repair belongs in the founder's
environment, not hidden inside a helper — task S3.

---

## Open, not chased

**S5.** `UserPromptSubmit` reported `78% used, 780,316 of 1,000,000`; the sensor snapshot written
seconds later reports `13%, 125,195`. Same session, same minute.

*Leading hypothesis, NOT verified:* the hook reads the last snapshot the status line wrote, and
the status line last wrote before the compaction — so immediately after a `/compact` the hook
reports the pre-compaction figure and is structurally one render behind.

*Probe that would settle it:* read `src/resolve.js`, then compare a snapshot's `writtenAtEpochMs`
against the hook's reported figure across a compaction boundary. Not run.
