---
title: "target — the syntax level"
description: "What downlevelling rewrites, what it cannot conjure, and the es2022 cliff that changes behaviour."
sidebar:
  order: 1
  label: "01 · target — the syntax level"
---

> **Purpose:** to pin down exactly what `target` buys and what it cannot buy.
> After this unit you can predict, for a given feature, whether lowering `target`
> will rewrite it, ignore it, or silently change what it *does* — and you will
> have seen one `target` change alter a program's runtime behaviour without
> touching a line of source.

## 1. The values

Ask the compiler rather than the documentation. Feed it a value it cannot
possibly accept and read the complaint:

```
$ tsc --target BOGUS x.ts
error TS6046: Argument for '--target' option must be: 'es6', 'es2015',
'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022',
'es2023', 'es2024', 'es2025', 'esnext'.
```

That is TypeScript 7.0.2, and it is also exactly what 6.0.3 says — the list has
been stable across that bump.

Read what is **missing**. There is no `es5` and no `es3`. They were removed, and
`"target": "es5"` — the single most widely published line on this subject — is now
a hard error. `es6` and `es2015` are the same value under two names, and es2015 is
the floor.

This is the first instance of the habit the course keeps insisting on: the value
list is a property of the compiler in front of you, not of the topic. Three
minutes with `--target BOGUS` beats any article, including this one.

## 2. Downlevelling is a syntax rewrite

`target` answers: **what will the host's parser accept?** If you write syntax
newer than that, the compiler rewrites it into something equivalent and older.

```ts
const cfg: { a?: { b: number } } = {};
export const v = cfg.a?.b ?? 0;
```

At `--target esnext`:

```js
const cfg = {};
export const v = cfg.a?.b ?? 0;
```

At `--target es2015`:

```js
var _a;
var _b;
const cfg = {};
export const v = (_b = (_a = cfg.a) === null || _a === void 0 ? void 0 : _a.b) !== null && _b !== void 0 ? _b : 0;
```

`?.` and `??` are es2020 syntax; a 2015 parser would throw `SyntaxError` before
running a line. So they became temporaries and explicit comparisons. `const`
stayed, because `const` *is* es2015 and there was nothing to do.

That is the whole mechanism. Newer syntax in, older syntax out, semantics
preserved — mostly. §5 is about the "mostly".

## 3. The hard limit: syntax yes, API no

Here is the boundary people cross without noticing.

```ts
export const r = [1, 2, 3].findLast(n => n > 1);
```

Compiled with `--target es2015 --lib esnext`:

```js
export const r = [1, 2, 3].findLast(n => n > 1);
```

No error, no rewrite, no helper. `Array.prototype.findLast` is es2023, we asked
for es2015 output, and the compiler emitted the call untouched.

It had no choice. `?.` is **syntax** — a shape the parser recognises, rewritable
into other shapes. `findLast` is an **API** — a method that either exists on the
array at runtime or does not. There is no rewrite that conjures it, and
TypeScript ships no polyfills. It never has.

So a low `target` protects you from `SyntaxError` and not from
`TypeError: r.findLast is not a function`. The option that governs the second is
`lib`, which we told to say `esnext` — and it did, and it was wrong, and nothing
objected. That is unit `02`.

> **The test, when you are unsure which side a feature is on:** could you write it
> in older JavaScript by hand, using only what that older JavaScript has? Optional
> chaining, yes — clumsily, with temporaries. `findLast`, no — not without
> implementing it, which is what a polyfill is and what the compiler will not do.

## 4. Where the rewrite stops being cosmetic

Downlevelling is usually boring. Sometimes it replaces a language feature with an
emulation that is observably different. Private fields are the clearest case:

```ts
export class C {
  x = 1;
  #secret = 2;
  reveal() { return this.#secret; }
}
```

At `--target es2022`:

```js
export class C {
    x = 1;
    #secret = 2;
    reveal() { return this.#secret; }
}
```

At `--target es2021`:

```js
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    /* … */
};
var _C_secret;
export class C {
    constructor() {
        this.x = 1;
        _C_secret.set(this, 2);
    }
    reveal() { return __classPrivateFieldGet(this, _C_secret, "f"); }
}
_C_secret = new WeakMap();
```

`#secret` is gone. In its place: a module-scoped `WeakMap`, keyed by instance,
plus a helper that throws if you read it off an object whose class did not declare
it. Functionally faithful, and *structurally* a different program — the field is
no longer on the object, so anything that inspects objects (a serialiser, a
deep-clone, a debugger, a `structuredClone`) sees something else.

One `target` line decides which of those two programs you ship.

## 5. The cliff at es2022

The sharpest case, because it changes behaviour rather than representation.

```ts
class Base { set v(n: number) { console.log("  base setter ran with", n); } }
class D extends Base { v = 5; }
new D();
```

Compile and run, changing only `target`:

```
===== target es2021 =====
  base setter ran with 5
===== target es2022 =====
(nothing)
```

Same source. Same runtime. Different behaviour.

At es2021 the field became `this.v = 5` in the constructor — an **assignment**,
which finds the inherited setter and calls it. At es2022 it stayed a native class
field, and native class fields use `Object.defineProperty` — **definition**, which
installs an own property and shadows the setter without ever invoking it.

The proximate cause is not `target` directly. It is `useDefineForClassFields`,
whose default `target` selects:

```
target es2022 + useDefineForClassFields:false  →  base setter ran with 5
target es2021 + useDefineForClassFields:true   →  (nothing)
```

Set it explicitly and the cliff moves with it. `target` was only choosing the
default.

Hold on to the shape of that, because you are about to meet it again: **`target`
does not do this itself — it silently picks the value of another option, and that
option does it.** `target` → `useDefineForClassFields` is the same mechanism as
`target` → `lib` in unit `02`, and both are the subject of unit `05`.

## 6. What `esnext` costs

`esnext` is not a version. It means "whatever this compiler currently considers
newest", which is a value that changes underneath you on upgrade — a *floating*
description of a host, in a file whose job is to describe a host precisely.

For an application you control end to end, that is usually fine: you upgrade the
compiler, you re-run the tests, you deploy.

For a **published library** it is a different bargain, because your `target` sets
the syntax floor for everyone who consumes your `dist`. `esnext` says: my
consumers' parsers are as new as my compiler was on the day I built. That may be
true. It has not been decided by anyone, which is the problem.

## 7. Choosing one

There is no universally correct value; there is a question that produces one.

> **What is the oldest parser that will read the file I emit?**

- **Application, own runtime.** The Node version in your Dockerfile. Node 24
  handles es2024 syntax comfortably; naming it is more honest than `esnext` and
  costs nothing.
- **Published library.** The oldest runtime you are willing to support, stated in
  `engines`. This is a support commitment, not a preference.
- **Input to a bundler.** Frequently irrelevant: the bundler has its own target
  and will downlevel again. Emitting `esnext` and letting it decide avoids
  downlevelling twice, which is both slower and worse output.

The failure mode when you get it wrong is loud and early — `SyntaxError` at
parse, before a line runs. Of the four options in this course, `target` is by a
distance the most forgiving. The quiet ones are next.

## 8. What this sets up

`target` describes the host's **syntax level** and nothing else. The moment the
question is "does this method exist at runtime", `target` has no opinion and no
power — and the option that does have an opinion has already been chosen for you,
because it defaults from `target`.

That is unit `02`, and it is where this course's central property finally has
teeth: a claim nothing verifies.

## References

- [TSConfig — `target`](https://www.typescriptlang.org/tsconfig/#target)
- [TSConfig — `useDefineForClassFields`](https://www.typescriptlang.org/tsconfig/#useDefineForClassFields)
- [MDN — Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties)
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
