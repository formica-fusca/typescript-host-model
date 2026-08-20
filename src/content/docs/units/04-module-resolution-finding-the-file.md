---
title: "moduleResolution — finding the file"
description: "Resolution as an algorithm you choose, exports conditions, and why a .ts file imports .js."
sidebar:
  order: 4
  label: "04 · moduleResolution — finding the file"
---

> **Purpose:** to treat resolution as a *lookup algorithm you are choosing*, not a
> compiler preference. After this unit you can say which algorithm a config
> selects, predict whether a given specifier is legal under it, explain why a `.ts`
> file imports `./thing.js`, and read a `package.json` `"exports"` map the way the
> compiler reads it — including which branch it takes and why the answer depends on
> the importing file.

## 1. The question

You wrote a string:

```ts
import { d } from "./dep";
import { State } from "@acme/state";
```

`moduleResolution` decides which file on disk each of those strings names. That
is all it does, and it does it before checking begins — resolution is what builds
the program that checking then runs over.

Nothing here is a preference. Every candidate value is an **imitation of a real
host's algorithm**, and choosing one is choosing which host you are claiming to
target. Get it wrong and the compiler will faithfully check a program that the
actual host cannot assemble.

## 2. The values, and two that were deleted

```
$ tsc --moduleResolution BOGUS x.ts
error TS6046: Argument for '--moduleResolution' option must be:
'node16', 'nodenext', 'bundler'.
```

Three. And the two that are missing are the interesting part:

```
$ tsc --moduleResolution node10 x.ts
error TS5108: Option 'moduleResolution=node10' has been removed.
Please remove it from your configuration.

$ tsc --moduleResolution classic x.ts
error TS5108: Option 'moduleResolution=Classic' has been removed.
Please remove it from your configuration.
```

`node` / `node10` — Node's *pre-ESM* algorithm — is gone, and `classic`, the
pre-Node one, with it. This matters more than a deprecation usually does, because
`"moduleResolution": "node"` is the single most-published line on this subject.
Copy it from almost any tutorial and you get TS5108.

The removal also **closes a bug class by deletion**. `node10` predates
`package.json` `"exports"` and therefore ignored it: a package could export
exactly one entry point through `exports`, Node would honour it, and `tsc` would
happily resolve some other file the package never meant to expose — or fail to
find it at all. Every surviving value reads `exports`. The "runs fine, fails to
compile" split that came from that mismatch is no longer reachable.

The three survivors split cleanly:

| Value | Imitates | Reads `exports` | CJS/ESM per file | Extensions required |
| ----- | -------- | :-------------: | :--------------: | :-----------------: |
| `node16` | Node, pinned to its 16-era rules | yes | yes | yes, in ESM |
| `nodenext` | Node, newest rules the compiler knows | yes | yes | yes, in ESM |
| `bundler` | webpack / vite / esbuild | yes | no | no |

## 3. Resolution leaves no trace in the output

Recall the probe from unit `00`:

```ts
import { d } from "./dep";
```

emitted, under `--moduleResolution bundler`, as:

```js
import { d } from "./dep";
```

The compiler resolved `./dep` to `dep.ts`, checked against it, then wrote the
original string and discarded what it found. **`tsc` never rewrites a specifier.**

Which tells you exactly what `moduleResolution` is and is not. It is not making
the import work. It is deciding whether the compiler *agrees in advance* that the
import will work. Choose `bundler` and you have asserted that something downstream
resolves extensionless specifiers. If that something does not exist — if the file
is handed straight to Node — you get `ERR_MODULE_NOT_FOUND` at runtime from a
build that was green.

That is the same shape as `lib` in unit `02`. A claim, believed, unchecked.

## 4. `exports`, and why the branch depends on the caller

A package with a conditional `exports` map — the normal shape for anything
published in the last few years:

```json
{
  "name": "dual",
  "exports": {
    ".": {
      "import":  { "types": "./esm.d.ts",   "default": "./esm.js" },
      "require": { "types": "./cjs.d.cts",  "default": "./cjs.cjs" }
    }
  }
}
```

The two branches deliberately declare *different* types — `"ESM-branch"` and
`"CJS-branch"` — so we can see which one the compiler took:

```ts
import { flavour } from "dual";
export const picked: "ESM-branch" = flavour;
```

Compile with identical flags (`--module nodenext --moduleResolution nodenext`),
changing only the **consumer's** `package.json`:

```
package type=module    → resolved the "import" branch  (clean)
package type=commonjs  → TS2322: Type '"CJS-branch"' is not assignable
                         to type '"ESM-branch"'.
```

Nothing about the *imported* package changed. What changed is the format of the
file doing the importing — which unit `03` showed is decided by `"type"` and the
extension.

**So the module format is an input to resolution.** That is the dependency that
forces this unit to come after unit `03`, and it is why `node16`/`nodenext`
resolution is meaningless without a matching `module` (§7). Under these values a
specifier does not have *an* answer; it has an answer relative to the file asking.

`bundler` takes the `"import"` branch and does not model the distinction at all —
verified, same file, clean compile. Which is right for a bundler, and wrong for
Node.

## 5. The extension rule

```ts
import { d } from "./dep";
```

in a package declared `{ "type": "module" }`:

```
nodenext → TS2835: Relative import paths need explicit file extensions in
           ECMAScript imports when '--moduleResolution' is 'node16' or
           'nodenext'. Did you mean './dep.js'?
bundler  → OK
```

This is not TypeScript being fussy. In ES modules, a specifier is a **URL**, and
URLs do not have an extension-guessing step. Node will not try `./dep.ts`, then
`./dep.js`, then `./dep/index.js` — that search was a CommonJS behaviour, and ESM
dropped it. `nodenext` is reporting Node's rule, at compile time, instead of
letting you find it in production.

Which resolves the question every newcomer asks about code like
`packages/acme/src/lib/entity.ts:1`:

```ts
import type { DomainEvent } from "./event-sourcing/domain-event.js";
```

A `.ts` file importing a `.js` file that does not exist. It is correct, and §3 is
why: **the specifier is copied verbatim into the output.** By the time anything
reads that string, compilation has happened and the neighbour really is
`domain-event.js`. You are not writing the name of the file you are importing from
— you are writing the name of the file your *output* will import from.

The rule generalises: under `node16`/`nodenext` you write specifiers for the
emitted tree, not the source tree.

## 6. What `bundler` relaxes

`bundler` reads `exports` and `imports` like the Node values, then drops the parts
that only a runtime needs to care about:

- extensionless specifiers are fine — `./dep` resolves;
- directory imports resolve to `index`;
- no CJS/ESM split, so no per-file condition selection.

It exists because bundlers genuinely do all of that, and modelling Node's
strictness for code that Node will never load produces false errors.

The cost is the one in §3: `bundler` is a promise about a build step. It is
correct when a bundler really is downstream, and it is a trap when someone later
runs `tsc` and ships the output directly — a change that touches no line of source
and breaks every extensionless import.

## 7. The pairing constraint

You cannot mix freely:

```
$ tsc --module esnext --moduleResolution node16 x.ts
error TS5110: Option 'module' must be set to 'Node16' when option
'moduleResolution' is set to 'Node16'.
```

`node16` resolution requires `module: node16`; `nodenext` requires
`module: nodenext`. The compiler refuses the combination outright.

Read that as a feature. §4 showed that under those values resolution *depends on*
the emitted format; a config that claimed Node's resolution while emitting some
other format would be describing a host that cannot exist. The error is the
compiler declining to model an impossible machine — which is exactly the check the
other three options in this course do not get.

It also explains the doubled-up lines you see everywhere:

```json
"module": "nodenext",
"moduleResolution": "nodenext"
```

Not redundancy. One is required by the other, and unit `05` shows that in most
configs one of the two lines is not even doing anything.

## 8. Choosing one

> **Which program will read this specifier — and by whose algorithm?**

- **Node loads the output directly.** `nodenext` (or a pinned `node16`/`node20`),
  with the matching `module`. Accept the extensions; they are Node's rule, not
  TypeScript's.
- **A bundler consumes the output.** `bundler`. And write down *where* — the
  moment that build step is removed, the config is describing a host that no
  longer exists.
- **A library published for others.** `nodenext`. You do not control your
  consumers' build, so the strictest correct model is the one that keeps you
  honest — an extensionless specifier that works in your bundler and breaks in a
  consumer's Node is your bug, not theirs.
- **`node10`.** Not available. If a tutorial tells you to, the tutorial predates
  the removal, and probably predates `exports` too.

## 9. What this sets up

All four options are now on the table, each described on its own terms. What
remains is how they reach into each other: `target` choosing `lib`, `module`
choosing `moduleResolution`, and both doing so by **replacement**, so that setting
one line can silently remove something you were relying on.

That is unit `05`, and it is short, because you have already met every mechanism
in it.

## References

- [TSConfig — `moduleResolution`](https://www.typescriptlang.org/tsconfig/#moduleResolution)
- [TypeScript Handbook — Module resolution reference](https://www.typescriptlang.org/docs/handbook/modules/theory.html)
- [Node.js — Package entry points and conditional exports](https://nodejs.org/api/packages.html#conditional-exports)
- [Node.js — ESM specifier resolution](https://nodejs.org/api/esm.html#import-specifiers)
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
