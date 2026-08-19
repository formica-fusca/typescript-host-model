---
title: "lib — the unverified promise"
description: "A green --strict build that throws ReferenceError, and the browser hiding in every Node project."
sidebar:
  order: 2
  label: "02 · lib — the unverified promise"
---

> **Purpose:** to make `lib` legible as a *claim* rather than a setting. After
> this unit you can read the loaded declaration chain out of a compiler instead of
> guessing it, explain why a Node-only project can type-check `document`, and say
> precisely where `lib` ends and `types` begins. You will also watch a green build
> throw `ReferenceError` on the first line it runs.

## 1. The claim

`lib` names the declaration files describing **what already exists at runtime,
before your code runs**: `Array.prototype.map`, `Promise`, `WeakMap`,
`structuredClone`, `document`.

Its values are the names of those files, minus the `lib.` prefix and the
`.d.ts` suffix. There are 107 of them on TypeScript 7.0.2, in three grades:

```
Full ES versions   es5, es6/es2015, es2016 … es2025, esnext
Granular slices    es2015.collection, es2019.array, es2022.error,
                   esnext.disposable, esnext.temporal, …
Host environments  dom, dom.iterable, dom.asynciterable,
                   webworker, webworker.importscripts, scripthost
```

You pass an array: `"lib": ["es2022", "dom"]`.

Unit `00` established that `lib` emits nothing. This unit is about what it does
instead, which is to be **believed**.

## 2. Green, then `ReferenceError`

Two lines. No tricks.

```ts
export const now = Temporal.Now.instant();
export const stamp = now.toString();
```

Type-check it as strictly as the compiler allows:

```
$ tsc --noEmit --strict --target esnext --lib esnext temporal.ts
  GREEN — zero errors
```

`Temporal` is in `lib.esnext.temporal.d.ts`, which `lib: ["esnext"]` pulls in. The
compiler is satisfied — fully, under `strict`. Now run the output on the same
machine that compiled it:

```
$ node o/temporal.js
  ReferenceError: Temporal is not defined
```

Node 24.18.0 does not ship `Temporal`. Nothing lied; nothing was checked. We told
the compiler the runtime has `Temporal`, the compiler took our word, and the word
was wrong.

**This is the course's thesis in eight lines.** `lib` is not a feature switch and
not a polyfill request. It is a description of a machine, and the compiler has no
way to look at the machine.

Sharpen it before moving on: `--strict` did not help. Strictness governs how
carefully the compiler reasons *from* your premises. It has no opinion about the
premises.

## 3. The default nobody set

Most projects never write a `lib` line. That does not make `lib` unset — it makes
it derived.

Ask the compiler what it actually loaded, with `--listFiles`:

```
$ tsc --noEmit --target esnext --listFiles dom.ts

lib.es5.d.ts  lib.es2015.d.ts  lib.es2016.d.ts  …  lib.es2025.d.ts
lib.esnext.d.ts
lib.dom.d.ts
lib.dom.iterable.d.ts
lib.dom.asynciterable.d.ts
lib.webworker.importscripts.d.ts
lib.scripthost.d.ts
… 80-odd granular files …
lib.esnext.full.d.ts
```

The last line names the culprit. With `lib` unset, `target` selects
`lib.<target>.full.d.ts`, and the `.full` variants are the ES library **plus the
browser**: DOM, DOM.Iterable, DOM.AsyncIterable, WebWorker.ImportScripts, and
ScriptHost.

So the default for a Node-only service, a CLI, or a server-side library is *a
browser*. This compiles clean in a package that will never see one:

```ts
const el = document.querySelector("div");
const ls = localStorage.getItem("k");
```

Nothing breaks today — you were not going to write that. What breaks is the
compiler's usefulness as a check: a subtle browser-only API reached for by a
dependency, an autocomplete offering `fetch`-adjacent DOM types, a copy-paste from
a frontend file. The tool that exists to tell you "that does not exist here" has
been told it does.

## 4. Replace, not merge

The fix is one line, and its mechanism is the thing to learn:

```
$ tsc --noEmit --target esnext --lib esnext --listFiles dom.ts

lib.es5.d.ts … lib.esnext.d.ts
… granular files …
(no lib.dom.d.ts)
(no lib.dom.iterable.d.ts)
(no lib.dom.asynciterable.d.ts)
(no lib.webworker.importscripts.d.ts)
(no lib.scripthost.d.ts)
(no lib.esnext.full.d.ts)
```

```
dom.ts(1,12): error TS2584: Cannot find name 'document'.
```

Writing `"lib": ["esnext"]` did not *add* `esnext` to what was there. It
**replaced** the whole set, and six files fell out — five of them ones you never
asked for and one, `lib.esnext.full.d.ts`, that you did not know existed.

This is the general rule for both couplings in this course, and unit `05` is
where it is stated properly:

> **A derived default is not a baseline. Setting the option discards it.**

The practical consequence is that `lib` is all-or-nothing. There is no "keep the
default and add one thing" — if you set it, you own the complete list. For a Node
project that list is usually one entry.

## 5. `console` is not JavaScript

A detail that catches everyone once, and clarifies what `lib` is scoped to:

```ts
export const p = process.version;
export const c = console.log;
```

| `lib` | `types` | Result |
| ----- | ------- | ------ |
| `["esnext"]` | `["node"]` | clean |
| `["esnext"]` | `[]` | `TS2591: Cannot find name 'process'` **and** `TS2584: Cannot find name 'console'` |
| `["esnext","dom"]` | `[]` | `TS2591: Cannot find name 'process'` only |

`console` is not in any ES library, at any version, because **`console` is not
part of ECMAScript**. It is a host API. The browser has one, described by
`lib.dom`. Node has one, described by `@types/node`. The language specification
has nothing to say about it.

Which explains the trap in §3 from the other side: narrow your `lib` to `esnext`
in a Node project and `console.log` stops resolving — not because you broke
something, but because you removed the *browser* declarations that had been
quietly supplying a Node global. The correct repair is `types`, not putting `dom`
back.

## 6. `lib` versus `types`

Two mechanisms, both adding ambient declarations, from different places under
different rules. They are not alternatives and neither substitutes for the other.

| | `lib` | `types` |
| --- | --- | --- |
| Supplies | the **language**: syntax-level built-ins | a **host's** API surface |
| Ships in | the compiler's own installation | `node_modules/@types/*` |
| Values | fixed names from a closed list | package names |
| Answers | "which ECMAScript version am I on?" | "what environment am I in?" |
| Default | derived from `target` (§3) | see §7 |

The pairing for a Node service is `"lib": ["es2024"]` plus `"types": ["node"]`:
the language at a stated version, and Node's API surface. Neither line implies the
other, and each is a separate claim that nothing verifies.

Where the compiler's own `lib.*.d.ts` files live is worth a note, because it moved
recently. TypeScript 6 keeps all 107 in `node_modules/typescript/lib/`.
TypeScript 7 — the native port — keeps **none** there; they are in a
platform-specific package, `node_modules/@typescript/typescript-<platform>/lib/`.
`--listFiles` prints absolute paths and is therefore the reliable way to find
them, on either compiler.

## 7. An open question

Documentation for `types` states that when the option is **absent**, all *visible*
`@types` packages are included automatically, and that setting it narrows the set.
Every probe run for this unit contradicts that.

With `@types/node` installed in `node_modules/@types/` directly beside the
`tsconfig.json`, and `types` unset, `process` did not resolve. It did not resolve
with an explicit `typeRoots` either. It resolved only with `"types": ["node"]`
written out. The result was identical on TypeScript 6.0.3 and 7.0.2, and identical
on `@types/node` 22 and 26 — so it is neither a version-specific regression nor a
packaging change.

**This is recorded as unresolved, not explained.** Either the auto-inclusion rule
has a precondition these probes did not satisfy, or it does not behave as
documented in this configuration. The unit does not need the answer — everything
taught above uses explicit values and reproduces — but it would be dishonest to
present the documented rule as verified when the evidence in front of us says
otherwise.

The practical guidance survives either way, and is what most projects should do
regardless: **write `types` explicitly.** A list you can read beats a default you
are unsure of.

## 8. Choosing one

> **What standard library will actually be there when this runs?**

- **Node service.** `"lib": ["es2024"]`, `"types": ["node"]`. Match the ES version
  to the Node version you deploy — Node 24 covers es2024 comfortably — and let
  `types` name the host.
- **Browser app.** `"lib": ["es2022", "dom", "dom.iterable"]`. Pick the ES version
  from your browser support floor, not from the newest thing you have heard of.
- **Published library.** The oldest library you are willing to require, and say so
  in `engines`. A library that claims `esnext` has claimed something about *other
  people's* runtimes.
- **Anything with polyfills.** `lib` is where you declare the polyfill's effect —
  it is the one case where a `lib` newer than the raw runtime is correct, because
  something is genuinely putting the API there. That reasoning belongs in a
  comment next to the line.

## 9. What this sets up

`target` describes the syntax level; `lib` describes the standard library; and
`lib`'s default is chosen by `target`, which is the second coupling of that shape
you have seen (`useDefineForClassFields` was the first, in unit `01`).

Both remaining options are about modules. Unit `03` takes the format that gets
emitted — and finds an option that stops answering the question itself and hands
it to `package.json`.

## References

- [TSConfig — `lib`](https://www.typescriptlang.org/tsconfig/#lib)
- [TSConfig — `types`](https://www.typescriptlang.org/tsconfig/#types) and
  [`typeRoots`](https://www.typescriptlang.org/tsconfig/#typeRoots)
- [TC39 — Temporal proposal](https://tc39.es/proposal-temporal/docs/)
- [MDN — `console`](https://developer.mozilla.org/en-US/docs/Web/API/console) — a
  host API, documented under Web APIs rather than JavaScript
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
