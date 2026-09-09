#!/usr/bin/env node
// Derive dist/types-cjs/**/*.d.cts (the "require" types in package.json#exports)
// from the ESM declarations in dist/types, rewriting relative .js specifiers to
// .cjs so the tree is self-contained: a .d.cts that imports from the ESM tree
// only compiles on TypeScript >= 5.8 (TS1479 for module node16 consumers).
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  rmSync
} from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'dist', 'types');
const outDir = join(__dirname, '..', 'dist', 'types-cjs');

const RELATIVE_JS_SPECIFIER = /(['"])(\.\.?\/[^'"]*)\.js\1/g;

rmSync(outDir, { recursive: true, force: true });

let count = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!entry.name.endsWith('.d.ts')) continue;
    const rewritten = readFileSync(path, 'utf-8').replace(
      RELATIVE_JS_SPECIFIER,
      '$1$2.cjs$1'
    );
    const outPath = join(
      outDir,
      relative(srcDir, path).replace(/\.d\.ts$/, '.d.cts')
    );
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, rewritten);
    count++;
  }
};
walk(srcDir);

if (count === 0) {
  console.error(`Error: no .d.ts files found in ${srcDir} — run build:types`);
  process.exit(1);
}
console.log(`Generated ${count} .d.cts files in ${outDir}`);
