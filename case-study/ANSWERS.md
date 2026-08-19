# Answers — host mismatch

All six questions, settled. Readable without the code open.

Every result below was produced by `npm run experiments` on Node v24.18.0 with
TypeScript 7.0.2, and is asserted by `npm test`.

## Table of Contents

- [1. The `lib` you did not write](#1-the-lib-you-did-not-write)
- [2. Green, then `ReferenceError`](#2-green-then-referenceerror)
- [3. A compiler option that defers to `package.json`](#3-a-compiler-option-that-defers-to-packagejson)
- [4. Why a `.ts` file imports `.js`](#4-why-a-ts-file-imports-js)
- [5. Which branch, and who decides](#5-which-branch-and-who-decides)
- [6. Syntax moves, APIs do not](#6-syntax-moves-apis-do-not)
- [The one sentence](#the-one-sentence)

## 1. The `lib` you did not write

**Yes — it type-checks, in a package that will never see a browser.**

```
lib unset (derived from target)    compiles clean
lib: ["esnext"]                    TS2584
```

With `lib` absent, `target` selects `lib.<target>.full.d.ts`, and the `.full`
variants are the ES library **plus the browser**: DOM, DOM.Iterable,
DOM.AsyncIterable, WebWorker.ImportScripts and ScriptHost. Nobody chose that. It
is what "no `lib` line" means.

The second row is the more instructive one. Writing `"lib": ["esnext"]` did not
*add* `esnext` — it **replaced** the whole set, and six files left the program.
That is the rule for every derived default in this course:

> A derived default is not a baseline. Setting the option discards it.

Which is why the repair in a Node project is two lines rather than one. Remove
the browser and you have also removed `console`, which is not part of
ECMAScript — it is a host API, supplied by `lib.dom` in a browser and by
`@types/node` in Node:

```json
"lib": ["es2024"],
"types": ["node"]
```

`packages/consumer/tsconfig.json` writes both, which is why it is the one
configuration here that describes a machine that exists.

## 2. Green, then `ReferenceError`

```
tsc --strict            GREEN — zero errors
node a.js (v24.18.0)    ReferenceError
```

`Temporal` is declared in `lib.esnext.temporal.d.ts`, which `lib: ["esnext"]`
pulls in. Node 24 does not ship `Temporal`. Nothing lied and nothing was checked.

The part worth sitting with is that **`--strict` did not help**. Strictness
governs how carefully the compiler reasons *from* your premises. It has no
opinion about the premises themselves. There is no strictness setting that
verifies `lib`, because verifying it would require the runtime, which is not
present at compile time and may not exist yet.

This is the whole course in eight lines. `lib` is not a feature switch and not a
polyfill request. It is a description of a machine, believed on your word.

## 3. A compiler option that defers to `package.json`

**Yes. The emitted JavaScript changes, with no tsconfig edited.**

```
"type": "module"      ESM — export const v = 1
"type": "commonjs"    CommonJS — exports.v = 1
```

Same compiler, same flags, same source.

`node16` / `node18` / `node20` / `nodenext` do not name a format. They say *use
Node's rule* — and Node's rule is per file: the nearest `package.json` `"type"`,
overridden by the file extension. `dual-lib` demonstrates the override, declaring
no `"type"` at all and letting `.mjs` and `.cjs` state each file's format
outright.

Three consequences:

1. There is no single answer to "what module format is this project?" under
   `nodenext`. There is an answer per file.
2. **`package.json` is a compiler input.** Editing `"type"` changes what `tsc`
   emits, and nothing in `tsconfig.json` records that dependency.
3. The compiler is *modelling a runtime rule*, not imposing a build rule. That is
   the point — it is how `tsc` can tell you in advance that Node will object.

## 4. Why a `.ts` file imports `.js`

```
moduleResolution: nodenext    rejected — TS2835
moduleResolution: bundler     accepted
```

In ES modules a specifier is a **URL**, and URLs have no extension-guessing step.
Node will not try `./describe.ts`, then `./describe.js`, then
`./describe/index.js` — that search was CommonJS behaviour and ESM dropped it.
`nodenext` reports Node's rule at compile time instead of letting you discover it
in production.

So why is `"./describe.js"` correct from a `.ts` file? Because **`tsc` never
rewrites a specifier.** It resolves `./describe.js` to `describe.ts` in order to
type-check, then emits the original string unchanged. By the time anything reads
that string, compilation has happened and the neighbour really is `describe.js`.

> Under `node16`/`nodenext` you write specifiers for the **emitted** tree, not the
> source tree.

The `bundler` row is the trap. It is not more permissive because bundlers are
better; it is a **claim that a build step exists downstream** to resolve those
specifiers. Delete the bundler from the pipeline and every extensionless import
becomes `ERR_MODULE_NOT_FOUND` at runtime, from a config that never stopped
compiling.

## 5. Which branch, and who decides

```
consumer "type": "module"      took the "import" branch (ESM-branch)
consumer "type": "commonjs"    took the "require" branch — TS2322
```

Nothing about `dual-lib` changed between those two runs. The compiler flags did
not change either. What changed is the **format of the file doing the
importing** — which question 3 established is decided by `"type"`.

So the module format is an *input to resolution*. A specifier under
`node16`/`nodenext` does not have an answer; it has an answer relative to the
file asking for it.

That dependency is the reason `moduleResolution: nodenext` is illegal without
`module: nodenext`:

```
TS5110: Option 'module' must be set to 'Node16' when option
        'moduleResolution' is set to 'Node16'.
```

And note what that error *is*: the only place in this whole subject where the
compiler checks one of your host claims against another. It cannot tell whether
`lib` matches your runtime, or whether a bundler is really downstream. It can
tell that two of your four claims are mutually impossible, and it does.
Everywhere else you are unsupervised.

`bundler` takes the `"import"` branch and does not model the distinction at all.
Correct for a bundler. Wrong for Node.

## 6. Syntax moves, APIs do not

```
target: es2024    syntax untouched, .at() emitted verbatim
target: es2018    syntax REWRITTEN, .at() emitted verbatim
```

Only the syntax moved.

`??` is **syntax** — a shape the parser recognises, rewritable into temporaries
and explicit comparisons. An es2018 parser would throw `SyntaxError` on it, so
the compiler rewrote it.

`.at()` is an **API** — a method that either exists on the array at runtime or
does not. No rewrite conjures it. TypeScript ships no polyfills and never has, so
it emitted the call untouched.

The test when you are unsure which side a feature falls on: *could you write this
by hand in the older JavaScript, using only what that JavaScript has?* Optional
chaining, yes, clumsily. `.at`, no — not without implementing it, which is what a
polyfill is and what the compiler will not do.

Which means a low `target` protects you from `SyntaxError` and not from
`TypeError: r.at is not a function`. The option governing the second is `lib` —
and in this experiment `lib` was held at `es2024`, promising `.at` exists, at
both targets. If that promise is false, `target` cannot save you.

## The one sentence

Six experiments, four options, one mechanism:

> **TypeScript cannot inspect the machine that will run your code, so it acts on
> a description you supply — and nothing checks the description against the
> machine.**

Everything above is a consequence. The green build that throws, the specifier
that resolves in your repo and nowhere else, the browser types in a Node
package: each is the description and the host disagreeing, with no one present to
notice.

The units take it from here — starting with what `tsc` is actually doing when it
reads a file, which is three separable jobs, not one.
