// The matrix, as assertions.
//
// `run.mjs` observes; this file states what the observations must be. If a
// future compiler changes one of these answers, this suite is what tells you —
// which matters more than usual here, because two of the values these
// experiments exercise were REMOVED from the compiler within recent versions.
// A course about describing hosts should notice when its own host moves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runAll } from "./run.mjs";

const results = Object.fromEntries(runAll().map((e) => [e.id, e.result]));
const r = (id) => results[id];

test("1 — an unset `lib` is derived from `target`, and ships the DOM", () => {
  const e = r("1-lib-default-ships-the-dom");
  assert.equal(e["lib unset (derived from target)"], "compiles clean",
    "with `lib` unset, target esnext selects lib.esnext.full.d.ts, which includes lib.dom");
  assert.match(e['lib: ["esnext"]'], /TS2584/,
    "setting `lib` REPLACES the derived value rather than extending it — the DOM leaves the program");
});

test("2 — `lib` is a claim, and nothing verifies it", () => {
  const e = r("2-lib-is-a-claim-nothing-verifies");
  assert.equal(e["tsc --strict"], "GREEN — zero errors",
    "--strict governs reasoning FROM your premises; it has no opinion about the premises");
  assert.equal(e[`node a.js (${process.version})`], "ReferenceError",
    "the described host has Temporal; the actual host does not. Nothing checked.");
});

test("3 — under the Node family, `module` delegates the format to package.json", () => {
  const e = r("3-module-format-is-delegated");
  assert.match(e['"type": "module"'], /^ESM/);
  assert.match(e['"type": "commonjs"'], /^CommonJS/,
    "same compiler, same flags, same source — a runtime file decided the output format");
});

test("4 — `moduleResolution` decides whether a specifier is even legal", () => {
  const e = r("4-the-resolver-decides-legality");
  assert.match(e["moduleResolution: nodenext"], /TS2835/,
    "ESM specifiers are URLs; Node does no extension guessing, and nodenext reports that at compile time");
  assert.equal(e["moduleResolution: bundler"], "accepted",
    "bundler models a build step. If that build step disappears, this line silently becomes a lie.");
});

test("5 — the `exports` branch depends on the importing file's format", () => {
  const e = r("5-exports-branch-depends-on-the-caller");
  assert.match(e['consumer "type": "module"'], /import.*branch/);
  assert.match(e['consumer "type": "commonjs"'], /TS2322/,
    "resolution consumes the module format, which is why `module` must be taught before `moduleResolution`");
});

test("6 — `target` rewrites syntax and never touches an API", () => {
  const e = r("6-target-rewrites-syntax-never-apis");
  assert.equal(e["target: es2024"], "syntax untouched, .at() emitted verbatim");
  assert.equal(e["target: es2018"], "syntax REWRITTEN, .at() emitted verbatim",
    "`??` is syntax and downlevels; `.at` is an API and cannot be conjured. TypeScript ships no polyfills.");
});
