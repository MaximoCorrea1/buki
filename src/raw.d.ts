/**
 * Vite (and so vitest) can import any file as a string with `?raw`. That is how the
 * popup's stylesheet gets asserted about from a test runner that has no DOM and no node
 * types - reading it with `node:fs` would mean taking on `@types/node` for one file.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
