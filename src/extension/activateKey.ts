/**
 * What pressing Activate does to the stored Pro state.
 *
 * A licence has FIVE activation slots and they are permanent: Polar creates one on every
 * `activate` call, and nothing but the customer's own deactivation gives one back. So
 * pressing Activate on a key you already hold has to VALIDATE the activation you have, not
 * create a sixth. **Five presses lock the person who paid out of their own licence, with no
 * self-service fix** — and the Activate button is exactly what a human presses repeatedly
 * when a key does not seem to take.
 *
 * EXTRACTED FROM `options.ts` ON 2026-08-25, and the reason is the review's, not a
 * preference. The rule lived as one line inside a click handler in a module that cannot be
 * imported — `options.ts` calls `main()` and `wirePro()` at module scope — so the only
 * guard possible was `expect(optionsSrc).toContain('activationId')`. **That guard was
 * MUTATION-PROVEN worthless**: replacing the reuse with `undefined` left 620/620 green,
 * because the identifier survived in the `writePro` spread and in four comments.
 *
 * This is the same move `saveBook.ts` made out of `background.ts`, for the same reason, and
 * §5 already records why a `?raw` guard cannot replace it: source text cannot see control
 * flow. `toContain('markRestored')` once passed with the call in dead code AND with its
 * arguments reversed.
 *
 * Both functions are pure and take the state rather than reading it, so a test can assert
 * with REAL VALUES instead of asserting that a string is present somewhere.
 */
import type { Exchange } from './license';
import type { ProState } from './proState';

/**
 * The activation id to offer the server, or nothing.
 *
 * SAME KEY means this install is already paired: send the id back and the server validates,
 * which creates nothing. A DIFFERENT key is a genuinely new pairing and must activate —
 * handing key B the activation belonging to key A asks Polar to validate an activation that
 * does not exist on it, which fails and looks exactly like a dead licence.
 *
 * Compares the TRIMMED paste, because `license.exchange` trims before sending and keys
 * arrive out of an email with a trailing newline. Comparing the raw field against a stored
 * trimmed key would find no match for a key that is in fact the same one, and quietly
 * activate again — which is this module's entire defect, wearing a space.
 */
export function activationFor(pasted: string, held: ProState): string | undefined {
  return held.key === pasted.trim() ? held.activationId : undefined;
}

/**
 * What to store after an exchange, or `null` for "store nothing".
 *
 * `null` is not "a state with no session": a retryable failure is an outage on our side, and
 * writing anything there would sign a paying customer out during it. The three outcomes are
 * genuinely different and the old code expressed them as two nested `if`s inside a click
 * handler nothing could reach.
 */
export function nextProState(
  pasted: string,
  held: ProState,
  result: Exchange,
): ProState | null {
  const key = pasted.trim();
  // Read ONCE, so the success and refusal branches below cannot disagree about which
  // activation this install is holding.
  const reuse = activationFor(pasted, held);

  if (result.ok) {
    // Prefer the fresh one: on a FIRST exchange we had none and Polar has just issued it.
    // Fall back to what we hold, because a validate response echoes the activation and if
    // it ever does not, forgetting the id would silently activate again next time.
    const id = result.activationId || reuse;
    // Omitted rather than empty-stringed when there is none, matching every other writer's
    // conditional spread, so a record that never had one round-trips unchanged instead of
    // gaining a field that means "no id".
    return { key, session: result.session, ...(id ? { activationId: id } : {}) };
  }

  // Might pass: offline, a captive portal, our own 429, Polar having a bad minute. Keep
  // whatever is already stored and let the server's grace window do its job.
  if (result.retryable) return null;

  // An answer rather than an outage: revoked, refunded, wrong key. The session goes so the
  // options page can say what is wrong, and the activation STAYS — this install is still
  // paired with Polar, so dropping the id would make the next success activate a second
  // time for the same machine.
  return { key, session: null, ...(reuse ? { activationId: reuse } : {}) };
}

/**
 * ONE PRESS OF ACTIVATE, end to end, with nothing left for the caller to get wrong.
 *
 * `activationFor` and `nextProState` are the arithmetic; this is the ORDER, and the order
 * was the other half of the defect. Extracting only the arithmetic left `options.ts` free
 * to build its own state and call `writePro` directly — a mutation proved exactly that, with
 * the whole suite green, because `proState.test.ts`'s source guard can only forbid the two
 * spellings it already knows and §5 records that a `?raw` guard cannot see control flow.
 *
 * **The review's fifth assertion — "retryable refusal → `writePro` not called" — is a
 * behaviour, not a string, and this is what makes it assertable.** The difference between
 * "wrote a state with no session" and "wrote nothing" is a paying customer signed out during
 * our own outage, and no amount of reading `options.ts` as text can tell the two apart.
 *
 * Returns the sentence to show. The caller says it; it does not decide it.
 */
export async function activate(deps: {
  /** Exactly what is in the field. Trimming is this module's job, once, in one place. */
  pasted: string;
  read: () => Promise<ProState>;
  exchange: (key: string, activationId?: string) => Promise<Exchange>;
  write: (state: ProState) => Promise<void>;
}): Promise<string> {
  const held = await deps.read();
  const result = await deps.exchange(deps.pasted, activationFor(deps.pasted, held));

  // `null` means store nothing, which is NOT the same as storing a state with no session.
  const next = nextProState(deps.pasted, held, result);
  if (next) await deps.write(next);

  if (result.ok) return 'Pro is on. Cover reading is unlimited.';
  // The server's own words when it has any: Polar says "revoked", "activation limit
  // reached", and those tell a customer what to do in a way "invalid licence" never does.
  return result.message ?? 'That key could not be activated.';
}
