---
title: "The three jobs of tsc"
description: "Resolve, check, emit — and which of the four options touches which. Defines what a host is."
sidebar:
  order: 0
  label: "00 · The three jobs of tsc"
---

> **Purpose:** to replace "these four options configure the build" with a
> three-column table you can place any of them into. After this unit you can say,
> for each of `target`, `lib`, `module` and `moduleResolution`, whether it changes
> the emitted JavaScript, changes what type-checks, or changes which files enter
> the program — and you will have watched two of the four change no output at all.

## 1. The four lines

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true
  }
}
```

Three of the four options this course is about are here. The fourth, `lib`, is
absent — which does not mean it is unset. It has a value; nobody chose it. Unit
`02` is largely about that sentence.

This is a real config, from a real published package, and it is not wrong. Start
from the assumption that whoever wrote it was competent, because the interesting
failures in this area are not carelessness — they are a description that was
accurate when it was written, applied to a host that changed.

## 2. Three jobs, not one

For each file it is given, `tsc` does three separable things:

| Job | Question | Failure mode |
| --- | -------- | ------------ |
| **Resolve** | This file says `from "./dep"` — which file is that? | `Cannot find module` |
| **Check** | Given every file now in the program, is this one type-correct? | any type error |
| **Emit** | Write the JavaScript. | none — emit does not fail |

They run in that order and they are genuinely separate. Resolution builds the
program; checking runs over the program; emit writes it out. A file can resolve
and fail to check. A file can fail to check and still be emitted — `tsc` emits by
default even with errors, which surprises people the first time they see stale
JavaScript from a red build.

The reason to hold these apart is that **the four options do not distribute
evenly across them**, and most confusion about this subject comes from assuming
they do.

## 3. The experiment: who touches the output?

One source file, using one piece of modern syntax and one modern operator:

```ts
const cfg: { a?: { b: number } } = {};
export const v = cfg.a?.b ?? 0;
```

Compile it four times, changing exactly one option each time. Everything below is
`tsc` 7.0.2 output, `--outDir out`, printed verbatim.

**A — the baseline.** `--target esnext --lib esnext --module esnext`:

```js
const cfg = {};
export const v = cfg.a?.b ?? 0;
```

The type annotation is gone — that is erasure, and it happens always. Otherwise
the file is unchanged.

**B — change `lib` only.** `--target esnext --lib es2015 --module esnext`:

```js
const cfg = {};
export const v = cfg.a?.b ?? 0;
```

**Byte-identical to A.** We just told the compiler it is targeting a runtime from
2015 — no `Promise.allSettled`, no `Object.entries`, none of a decade of standard
library — and the output did not move. `lib` emitted nothing, because `lib` is not
about emit.

**C — change `target` only.** `--target es2015 --lib esnext --module esnext`:

```js
var _a;
var _b;
const cfg = {};
export const v = (_b = (_a = cfg.a) === null || _a === void 0 ? void 0 : _a.b) !== null && _b !== void 0 ? _b : 0;
```

Now something happened. `?.` and `??` are syntax, es2020 syntax, and a host stuck
at es2015 would throw a `SyntaxError` on them — so the compiler rewrote them into
temporaries and explicit comparisons. Note `const` survived: `const` *is* es2015,
so there was nothing to do.

**D — change `module` only.** `--target esnext --lib esnext --module commonjs`:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v = void 0;
const cfg = {};
exports.v = cfg.a?.b ?? 0;
```

The module wrapper changed completely and `?.` was left alone. `module` rewrote
the import/export machinery and touched nothing else.

**The result to keep:** of the two options that emit, they emit *different parts
of the file*. `target` owns the expressions and statements; `module` owns the
imports and exports. And `lib` produced no diff whatsoever.

## 4. The other half: who touches the check?

Run the inverse experiment on one line:

```ts
const el = document.querySelector("div");
```

| Options | Result |
| ------- | ------ |
| `--target esnext` (no `lib`) | compiles clean |
| `--target esnext --lib esnext` | `TS2584: Cannot find name 'document'.` |

Same `target`. Same emitted output — the line erases to itself either way. The
only thing that moved is whether the compiler *agreed to it*. That is `lib`'s
entire job, and unit `02` is about why the first row is the surprising one.

`moduleResolution` works the same way from the other end: it decides whether
`from "./dep"` names a file that exists. Get it wrong and you get an error;
get it right and the emitted line is the same line either way — as §7 shows.

## 5. The table

Place each option in its column. This is the artefact the rest of the course
refers back to.

| Option | Resolve | Check | Emit |
| ------ | :-----: | :---: | :--: |
| `target` | — | indirectly¹ | **yes** — expressions and statements |
| `module` | — | slightly² | **yes** — imports and exports |
| `lib` | yes³ | **yes** | — |
| `moduleResolution` | **yes** | yes⁴ | — |

1. `target` does not check anything itself. It *selects* `lib` when `lib` is
   unset, and `lib` checks. Unit `05` is about that indirection.
2. `module` gates a few module-adjacent constructs — top-level `await`,
   `import.meta`, dynamic `import()`. Small, real, and covered in unit `03`.
3. `lib` decides which `.d.ts` files are loaded into the program, which is a
   resolution act, though not the specifier-shaped one people mean by the word.
4. Resolution failures surface as errors, so it changes the check by changing
   what is in the program to check against.

Two of the four never write a byte. **They are not build settings.** They are
assertions, and the next section says what they are asserting about.

## 6. What a host is

A **host** is whatever will load and run the emitted JavaScript. Three things
bundled together:

1. a **syntax level** — what its parser accepts;
2. a **standard library** — what already exists before your code runs;
3. a **module system** — how a file declares imports, and how a specifier string
   becomes a file.

Node 24 is a host. Chrome 141 is a host. A Cloudflare Worker is a host. A bundler
is a *pretend* host: it resolves and links like one, then hands the result to a
real one — which is how a single project ends up with two hosts that disagree
about the same source tree (unit `07`).

TypeScript never inspects the host. It cannot: the host is not present at compile
time, there may be several, and it may not exist yet. So the compiler works from
a **description**, and the four options are that description — one per line of
the list above, with the module system taking two because emitting a format and
finding a file are different problems.

**Nothing verifies the description.** There is no check, no warning, no runtime
handshake. You assert `lib: ["esnext"]` and the compiler proceeds as though
`Array.prototype.findLast` exists; whether it does is between you and your
deployment. Every failure in this course is that gap.

> **A collision worth defusing now.** TypeScript's own API uses "Host" for the
> opposite thing. `CompilerHost`, `ModuleResolutionHost` and `LanguageServiceHost`
> are interfaces built from `fileExists` and `readFile` — they describe the
> environment **the compiler itself** runs in, the thing handing `tsc` bytes off a
> disk. That host is where compilation *happens*; ours is where the output *ends
> up*. This course always means the second, and writes "compiler host" in full on
> the rare occasions it means the first.

## 7. The seam: `tsc` never rewrites a specifier

One more probe, because it is the sharpest illustration that resolve and emit are
disconnected — and it is the fact unit `04` is built on.

```ts
import { d } from "./dep";
export const y = d;
```

Compiled with `--module esnext --moduleResolution bundler`, which accepts an
extensionless specifier:

```js
import { d } from "./dep";
export const y = d;
```

The specifier came out **exactly as written**. TypeScript resolved `./dep` to
`dep.ts` in order to check it, then emitted the original string and forgot what it
found.

Sit with that. The compiler knows the answer and does not write it down. Which
means `moduleResolution` is not describing what the output will *do* — the output
will do whatever the host does with `"./dep"`. It is describing **what you believe
the host will do**, so that the compiler can agree or disagree with you in
advance. Choose `bundler` and you are promising that something downstream will
resolve that string. If nothing does, Node throws `ERR_MODULE_NOT_FOUND` on a
build that was green.

## 8. What this sets up

You now have the table, and you have watched every claim in it. The next four
units take one option each, in the order that avoids forward references: `target`
(unit `01`) before `lib` (unit `02`), because `target` chooses `lib`'s default;
`module` (unit `03`) before `moduleResolution` (unit `04`), because the module
format is an input to the resolution algorithm.

Then unit `05` returns to those two "before" clauses, which are the couplings, and
the reason a config can change meaning when you touch a line you thought was
unrelated.

Two phrases to carry forward, because the rest of the course leans on them:

- **A claim nothing verifies.** Every one of the four is one.
- **The description and the host can disagree.** That is not an error state. It
  is a compile that is green and a program that is broken.

## References

- [TSConfig reference — `target`, `lib`, `module`, `moduleResolution`](https://www.typescriptlang.org/tsconfig/)
- [TypeScript Handbook — Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
