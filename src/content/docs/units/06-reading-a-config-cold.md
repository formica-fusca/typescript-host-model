---
title: "Reading a config cold"
description: "Four unfamiliar configs, four questions each, answers folded away. Practice, not exposition."
sidebar:
  order: 6
  label: "06 · Reading a config cold"
---

> **Purpose:** practice, not exposition. Four configs you have not seen, four
> questions each, answers checked against a compiler. After this unit you can pick
> up an unfamiliar `tsconfig.json`, state what host it describes, and name the
> decisions it has left to a derivation rule.

## 1. How to use this unit

Cover the answer. Write your four answers down. Then read.

Writing them down matters more here than it sounds. The failure mode this unit
targets is not ignorance — you have read five units — it is the feeling of
recognition that comes from seeing a familiar option name and skipping the
derivation. A prediction you committed to on paper is falsifiable; one you held
loosely gets revised on contact and teaches nothing.

## 2. The four questions

Ask these of any config, in this order:

1. **What syntax comes out?** → `target`, and whether anything downlevels.
2. **What does the checker believe exists?** → `lib` if written; otherwise
   `lib.<target>.full.d.ts`, browser included.
3. **What module format does each file get?** → `module`; and under the Node
   family, the nearest `package.json` `"type"` plus the extension.
4. **How is a specifier resolved?** → `moduleResolution` if written; otherwise
   implied by `module` — Node family means Node, everything else means bundler.

Then one follow-up that catches most real problems:

5. **Is there a host that matches all four?** Not four defensible answers — one
   machine that satisfies all of them at once.

## 3. Specimen A — the Node library

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "declaration": true,
    "strict": true
  },
  "include": ["src/**/*"]
}
```

Alongside it, `package.json` contains `"type": "module"`, and the package is
published to npm.

<details>
<summary>Answers</summary>

1. **Syntax:** whatever the compiler considers newest, emitted untouched. Nothing
   downlevels. On upgrade, the emitted syntax can get newer without any file in
   the repo changing.
2. **Beliefs:** `lib.esnext.full.d.ts` — every ES library **plus DOM,
   DOM.Iterable, DOM.AsyncIterable, WebWorker.ImportScripts and ScriptHost**. For
   a Node library this is wrong in both directions: `document` type-checks, and
   `process` does not (no `types` line).
3. **Format:** every `.ts` under `src` is ESM, from `"type": "module"`. A `.cts`
   file would be CommonJS, and there are none.
4. **Resolution:** Node's. Relative specifiers need explicit extensions —
   `./thing.js`, written in `.ts` files. `moduleResolution` is redundant here
   (unit `05` §5) and worth keeping as documentation.
5. **Matching host:** none, quite. `target: esnext` on a *published* package sets
   the syntax floor for every consumer, and no one decided what that floor is.
   Combined with the DOM in the lib chain, this config describes "a browser with
   the newest possible parser" for a package that will run on whatever Node its
   consumers have.

**The repair is two lines**, and neither is `target`:

```json
"lib": ["es2024"],
"types": ["node"]
```

This is a real config shape, not a constructed one. It is what a Node-only
package's `tsconfig.json` looks like in a production monorepo, and the DOM
observation was verified there before it was written here.
</details>

## 4. Specimen B — the bundled app

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "lib": ["es2022", "dom", "dom.iterable"],
    "strict": true,
    "noEmit": true
  }
}
```

<details>
<summary>Answers</summary>

1. **Syntax:** none. `noEmit: true` — `tsc` writes nothing at all. Something else
   produces the JavaScript.
2. **Beliefs:** exactly what is listed. es2022 plus the browser DOM, and no
   `@types` unless `types` is set elsewhere. An explicit, reviewable claim — the
   opposite of Specimen A.
3. **Format:** `preserve` means module syntax is not transformed. Since nothing is
   emitted, this matters only for *legality*: top-level `await` and `import.meta`
   are permitted (unit `03` §3).
4. **Resolution:** bundler. Extensionless specifiers and directory imports resolve.
   `exports` maps are read; conditions are not selected per importing file.
5. **Matching host:** yes, and it is honest about not being the whole story.
   `noEmit` plus `bundler` says: *I am a type-checker in a pipeline; the bundler
   is the compiler.* The `target` line still does real work — it sets which syntax
   is legal and, had `lib` been absent, would have chosen it.

The one thing this config does **not** record is which bundler, or that there is
one at all. Remove the build step and every claim here quietly becomes false.
That is unit `07`.
</details>

## 5. Specimen C — the tutorial config

```json
{
  "compilerOptions": {
    "target": "es5",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true
  }
}
```

<details>
<summary>Answers</summary>

Trick specimen. It does not compile:

```
tsconfig.json(1,34): error TS5108: Option 'target=ES5' has been removed.
Please remove it from your configuration.
tsconfig.json(1,83): error TS5108: Option 'moduleResolution=node10' has been
removed. Please remove it from your configuration.
```

Two of four options are dead values on a current compiler. Note the second
message: you wrote `"node"` and the compiler answers about `node10`, because
`"node"` was always an alias for Node's pre-ESM algorithm.

This is the most-published tsconfig on the internet and it was reasonable advice
for years. Two things to take from it:

- **The value list is a property of your compiler.** `--target BOGUS` answers in
  three seconds and is never out of date.
- **`module: commonjs` survived.** The failure is not "CommonJS is obsolete" —
  it is that the *resolver* which understood only CommonJS is gone, because every
  remaining resolver reads `exports`.
</details>

## 6. Specimen D — the polyfilled app

```json
{
  "compilerOptions": {
    "target": "es2018",
    "lib": ["es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

<details>
<summary>Answers</summary>

1. **Syntax:** downlevelled to es2018. `?.` and `??` become temporaries and
   comparisons.
2. **Beliefs:** es2022 APIs exist. Note this is *higher* than the target.
3. **Format:** ES modules, emitted untransformed.
4. **Resolution:** bundler.
5. **Matching host:** an old parser with a modern standard library — which is
   exactly what a polyfilled browser is. This is the one legitimate reason to set
   `lib` above `target`.

Compile `[1,2].at(-1)` alongside `({a:1})?.a ?? 0` and both halves are visible in
one file:

```js
var _a;
var _b;
export const r = [1, 2].at(-1);
export const v = (_b = (_a = ({ a: 1 })) === null || _a === void 0 ? void 0 : _a.a) !== null && _b !== void 0 ? _b : 0;
```

`.at` — an es2022 **API** — is emitted verbatim, because `lib` said it exists and
`target` has no power over APIs (unit `01` §3). `?.` — es2020 **syntax** — is
rewritten, because `target` does have power over syntax.

**The config is only correct if a polyfill actually runs before this code.**
Nothing in the file says so, nothing checks it, and the line that depends on it
is `lib`. This config deserves a comment more than any other in the unit.
</details>

## 7. The checklist

Condensed, for a config you meet in the wild:

- [ ] Is `lib` written? If not, it is `<target>.full` — **including the browser**.
- [ ] Is `types` written? If not, do not assume you know what is loaded (unit `02`
      §7).
- [ ] Is `module` in the Node family? Then the answer is in `package.json`, not
      here.
- [ ] Is `moduleResolution` written, and is it doing anything (unit `05` §5)?
- [ ] Is `target` at es2022 or above? Then class fields use define semantics.
- [ ] Is this package **published**? Then `target` is a support commitment.
- [ ] Is there a build step after `tsc`? If so, which claims depend on it
      existing?
- [ ] **Can you name one machine that satisfies all four claims?**

## 8. What this sets up

Every specimen except C described a host that could exist. The last question is
the one that keeps failing in practice, and it fails in a specific way: not
because someone chose badly, but because the pipeline changed and the description
did not.

Unit `07` works that backwards — from symptom to the false claim — and takes the
one case this unit kept deferring: what to do when there genuinely are two hosts
and one config.

## References

- [TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
