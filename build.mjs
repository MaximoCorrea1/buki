import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

// Typecheck first - esbuild only strips types, it never checks them, so without this a
// type error ships silently.
//
// Spawned via process.execPath (the absolute path of the node running this file) rather
// than an `npm run typecheck &&` chain: npm hands scripts to cmd.exe, whose shim quoting
// breaks on some Windows setups ("node" is not recognized). Going through node directly
// means `node build.mjs` behaves identically from PowerShell, Git Bash, or an npm script.
const tsc = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], {
  stdio: 'inherit',
});
if (tsc.status !== 0) {
  console.error('Typecheck failed - not building.');
  process.exit(tsc.status ?? 1);
}

await build({
  entryPoints: {
    content: 'src/extension/content.ts',
    popup: 'src/extension/popup.ts',
    background: 'src/extension/background.ts',
    options: 'src/extension/options.ts',
    // Its own bundle because it has to run in <head>, before the first paint, and MV3's
    // default extension CSP (script-src 'self') blocks an inline block outright. See the
    // header of theme.ts.
    theme: 'src/extension/theme.ts',
  },
  outdir: 'dist',
  bundle: true,
  // The catch tray's typeface, inlined as a data URL at build time.
  //
  // It renders inside somebody else's page, so it cannot reference an extension file
  // without a `web_accessible_resources` entry matching <all_urls> - the exposure
  // docs/brand.md refused immediately before store review. Inlining removes the question
  // entirely: nothing is exposed, the manifest does not change, and the bytes are already
  // in the package. It costs about 34KB in content.js, which is a local read rather than
  // a request.
  loader: { '.woff2': 'dataurl' },
  format: 'iife',
  platform: 'browser',
  target: 'chrome110',
  logLevel: 'info',
});

console.log('Built dist/{content,popup,background,options,theme}.js');
