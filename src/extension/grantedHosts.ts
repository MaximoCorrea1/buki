/**
 * The sites Buki has been let into, and which of them the reader can take back.
 *
 * WHAT WAS MISSING. `OPENWORK.md` item 46, TM-11. `mayFetch` asks for one host at a time,
 * derived from the right-clicked image's own URL, and the options page asks for one more
 * when somebody points recognition at their own endpoint. Both are per-use asks, which is
 * the framing `docs/store/permissions.md` gives a reviewer and it is true. What was not
 * true by implication is that the grant is temporary: **nothing ever called
 * `chrome.permissions.remove`**, so a permission given once for one cover was held for the
 * life of the install, and the reader had no way to see it, let alone end it.
 *
 * A per-use ask with no way back is a permanent grant collected one prompt at a time.
 *
 * THE DECISION LIVES HERE rather than in `options.ts`, which no test can import: that file
 * registers listeners at module scope. Same reason `activateKey.ts` and `ensureTray.ts`
 * exist. What stays in `options.ts` is wiring.
 */

/** One row, as a person reads it. */
export interface GrantedHost {
  /** The match pattern, which is what `chrome.permissions.remove` takes. */
  origin: string;
  /** What the row says. A site name, not a pattern. */
  host: string;
}

/**
 * The empty state, which is an invitation rather than a status line.
 *
 * `docs/brand.md`: an empty state is an invitation. "No sites" tells the reader a fact
 * about right now and leaves them wondering whether the section is broken; this tells them
 * when a row would appear, which is the thing they actually want to know.
 */
export const NO_HOSTS_YET =
  'No sites yet. Buki asks for one when you right-click a cover on a site it has not read from before.';

/**
 * What the status line says after a removal.
 *
 * The fear behind this button is *"will this delete the books I caught there?"*. It will
 * not: a grant and a shelf are unrelated, and the sentence that settles it costs nothing
 * to say at the moment the reader is worried about it.
 */
export const forgotten = (host: string): string =>
  `${host} removed. Buki will ask again next time you catch a book there.`;

/**
 * And when Chrome declines.
 *
 * `docs/brand.md`: an error names what failed and never apologises. It also has to say
 * what is now TRUE, because a failed removal leaves the grant exactly where it was and a
 * reader who saw a button move will otherwise assume it worked.
 */
export const stillAllowed = (host: string): string =>
  `Chrome would not remove ${host}. It is still allowed.`;

/** `https://covers.example.com/*` reads back as `covers.example.com`. */
function nameOf(origin: string): string | null {
  const match = /^https:\/\/([^/]+)\/\*$/.exec(origin);
  const host = match?.[1];
  if (!host) return null;
  // The bare wildcard is the whole web. Naming it `*` would be technically right and
  // would hide the only grant a reader would urgently want to end.
  return host === '*' ? 'every site' : host;
}

/**
 * The grants worth showing a remove button beside.
 *
 * @param granted what `chrome.permissions.getAll()` reported, which mixes the manifest's
 *   REQUIRED hosts in with the optional ones and does not distinguish them.
 * @param required the manifest's own `host_permissions`.
 *
 * Required hosts are filtered out because `chrome.permissions.remove` silently declines
 * them: it resolves false and nothing changes. Rendering a button that cannot work is
 * worse than rendering nothing, because the reader believes the grant is gone.
 */
export function revocableHosts(
  granted: readonly string[] | undefined,
  required: readonly string[],
): GrantedHost[] {
  const held = new Set(required);
  const seen = new Set<string>();
  const rows: GrantedHost[] = [];

  for (const origin of granted ?? []) {
    if (held.has(origin) || seen.has(origin)) continue;
    const host = nameOf(origin);
    if (!host) continue; // a pattern this module cannot read is not one it can name
    seen.add(origin);
    rows.push({ origin, host });
  }

  // By the name on the row, not by the pattern, so the order matches what is read and a
  // repaint after a removal does not reshuffle the rows that are left.
  return rows.sort((a, b) => a.host.localeCompare(b.host));
}
