---
title: "module — the emitted format"
description: "Three families of value, and why nodenext is a delegation to package.json rather than an answer."
sidebar:
  order: 3
  label: "03 · module — the emitted format"
---

> **Purpose:** to separate the three families of `module` value and land the
> conceptual jump the Node family makes. After this unit you can predict the module
> wrapper `tsc` will write, name which constructs a given `module` value forbids,
> and explain why `"module": "nodenext"` is not an answer but a **delegation** —
> one whose real answer lives in a `package.json` you may not have written.

## 1. The values, in three families

```
$ tsc --module BOGUS x.ts
error TS6046: Argument for '--module' option must be: 'commonjs', 'es6',
'es2015', 'es2020', 'es2022', 'esnext', 'node16', 'node18', 'node20',
'nodenext', 'preserve'.
```

Eleven values, three families, and the families behave so differently that
treating the list as a spectrum is the main way people get lost:

| Family | Values | What it says |
| ------ | ------ | ------------ |
| **Fixed ES** | `es6`/`es2015`, `es2020`, `es2022`, `esnext` | Emit ES modules. The version says which module-adjacent features are allowed. |
| **Fixed CJS** | `commonjs` | Emit `require` / `exports`. |
| **Node** | `node16`, `node18`, `node20`, `nodenext` | Do not pick one. Decide per file, the way Node does. |
| **Neither** | `preserve` | Do not transform module syntax at all. |

`module` owns exactly one part of the output: the import/export machinery. Unit
`00` showed it rewriting the wrapper while leaving `?.` untouched — that division
between `target` and `module` is clean and holds everywhere.

## 2. What the fixed values emit

One source file:

```ts
export const v = 1;
```

`--module esnext` (and every other fixed ES value, and `preserve`):

```js
export const v = 1;
```

`--module commonjs`:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v = void 0;
exports.v = 1;
```

The `__esModule` marker is how a CommonJS consumer can tell that this file was
*originally* an ES module — the flag interop shims look for. It is a convention,
not a standard, and it is the seam where CJS/ESM interop lives. This course stops
here (see the course's deferred list); what matters is that `module` decides
whether that seam exists in your output at all.

## 3. `module` gates syntax too

`module` is not purely an emit setting. A few constructs are only *legal* at
certain values, so the option changes what type-checks as well:

```ts
export const v = await Promise.resolve(1);   // top-level await
```

```
module es2020  → TS1378: Top-level 'await' expressions are only allowed when
                 the 'module' option is set to 'es2022', 'esnext', 'system',
                 'node16', 'node18', 'node20', or 'nodenext', and the 'target'
                 option is set to 'es2017' or higher.
module es2022  → OK
```

Likewise `import.meta`:

```ts
export const meta = import.meta.url;
```

```
module es2015    → TS1343: The 'import.meta' meta-property is only allowed
                   when the '--module' option is 'es2020', 'es2022', 'esnext',
                   'system', 'node16', 'node18', 'node20', or 'nodenext'.
module commonjs  → TS1343 (same)
module es2020    → OK
```

Both diagnostics are worth reading closely, because they are the compiler
enumerating its own rule — more reliable than any table, this one included.

One aside that reinforces unit `02`. At `module: es2020` the `import.meta` line
still failed, with a *different* error:

```
TS2339: Property 'url' does not exist on type 'ImportMeta'.
```

`module` legalised the meta-property; the `url` property on it is declared by the
**host**, via `@types/node` or `lib.dom`. Two options, two separate claims, one
line of code. `module` said the syntax is allowed here; nothing yet has said this
host puts a `url` on it.

## 4. The jump: `nodenext` is a delegation

Here is where `module` stops being a value in the ordinary sense.

Take one file, compile it twice with **identical compiler options** —
`--module nodenext --moduleResolution nodenext` both times — changing only the
`package.json` sitting next to it:

```ts
export const v = 1;
```

```
--- package.json  { "type": "module" } ---
export const v = 1;

--- package.json  { "type": "commonjs" } ---
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v = void 0;
exports.v = 1;
```

Same compiler, same flags, same source, different output.

`node16` / `node18` / `node20` / `nodenext` do not name a format. They say: **use
Node's rule.** And Node's rule is per file — the nearest `package.json` `"type"`
field, overridden by the file extension (§5). The compiler option has handed the
decision to a file that is not a compiler config, that may have been written by
someone else, and that is read at *runtime* by Node for its own purposes.

Three consequences follow, and they explain most of the confusion around these
values:

1. **There is no single answer to "what module format is this project?"** under
   `nodenext`. There is an answer per file, and a monorepo can hold both.
2. **`package.json` is now a compiler input.** Editing `"type"` changes what `tsc`
   emits, and nothing in `tsconfig.json` records that dependency.
3. **The compiler is modelling a runtime rule rather than imposing a build rule.**
   That is the whole point: it is how `tsc` can tell you in advance that Node will
   reject something.

The numbered variants — `node16`, `node18`, `node20` — pin *which* Node's rules to
model, since Node's own behaviour has changed over releases. `nodenext` floats to
the newest the compiler knows, with the same stability trade-off `esnext` carries
in unit `01`.

## 5. Extension beats `package.json`

The per-file rule has two inputs, and the extension wins. In a package declared
`{ "type": "module" }`:

| Source | Emitted file | Format |
| ------ | ------------ | ------ |
| `a.ts` | `a.js` | ESM — inherited from `"type": "module"` |
| `b.cts` | `b.cjs` | **CommonJS** — the extension overrides |
| `c.mts` | `c.mjs` | ESM — the extension states it explicitly |

```js
// o/b.cjs — inside a "type": "module" package
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v = void 0;
exports.v = 1;
```

Note the output extension changed too. `tsc` picked the filename, because under
Node's rules the filename *is* part of the declaration — `.cjs` means CommonJS
regardless of any `package.json`, and `.mjs` means ESM regardless.

That is the practical use of `.mts` and `.cts`: pinning one file's format against
its package's default. A CommonJS config file in an ESM package, or the reverse.

## 6. `preserve`, and knowing when not to decide

`preserve` emits module syntax exactly as written and transforms nothing. It
exists for a specific situation: **something downstream owns this decision.**

When a bundler consumes your output, it has its own module handling, its own
target, and its own idea of what the final format should be. Having `tsc` rewrite
ESM into CommonJS so that the bundler can rewrite it back is work that costs time
and loses information — tree-shaking in particular works better on untransformed
ES modules.

`preserve` is the honest declaration that this config does not know the host,
because the host is chosen further down the pipeline. Unit `07` returns to what
that costs.

## 7. Choosing one

> **Who loads the emitted file, and by whose rules?**

- **Node runs it directly.** `nodenext`, or a pinned `node20`/`node22` if you want
  the model to stay put across compiler upgrades. Then set `"type"` in every
  `package.json` deliberately, because you have just made it a compiler input.
- **A bundler consumes it.** `preserve`, or `esnext`. Let the bundler decide.
- **You publish for both.** This is the dual-package problem, and it is a design
  question rather than a config one. It is on the course's deferred list; see
  `lib/2025-12-26_inversify-dual-package-hazard`.
- **Legacy CommonJS project.** `commonjs`, and know that you are opting out of
  `import.meta` and top-level `await` (§3).

The value most projects should *not* pick without a reason is a bare fixed ES
value while running on Node. It emits `import` statements and says nothing about
whether Node will treat the file as ESM — the two can disagree, and then Node
throws `SyntaxError: Cannot use import statement outside a module` on a build that
compiled cleanly.

## 8. What this sets up

`module` decides the format each file is emitted *in*. It does not decide what
`from "./dep"` means — and under `nodenext`, the format it just decided becomes an
**input** to that question, because Node resolves specifiers differently in ESM
files than in CommonJS ones.

That is unit `04`, and it is why the two options must be taught in this order.

## References

- [TSConfig — `module`](https://www.typescriptlang.org/tsconfig/#module)
- [TypeScript Handbook — Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [Node.js — Determining module system](https://nodejs.org/api/packages.html#determining-module-system)
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
