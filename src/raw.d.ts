/**
 * Vite (and so vitest) can import any file as a string with `?raw`. That is how the
 * popup's stylesheet gets asserted about from a test runner that has no DOM and no node
 * types - reading it with `node:fs` would mean taking on `@types/node` for one file.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}

/**
 * `import.meta.glob` is vite's, not TypeScript's, and pulling in `vite/client` for it
 * would drag the whole DOM and worker surface in behind one call. This is the narrow
 * slice the host guard uses, and the reason it globs rather than listing files by hand:
 * the last rename broke because three files carrying the host postdated the list.
 */
interface ImportMeta {
  glob(
    patterns: string | string[],
    options: { query: '?raw'; import: 'default'; eager: true },
  ): Record<string, string>;
}
