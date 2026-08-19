---
title: "The couplings"
description: "target chooses lib, module chooses moduleResolution — and both replace rather than merge."
sidebar:
  order: 5
  label: "05 · The couplings"
---

> **Purpose:** to make the wiring between the four options explicit, so that a
> config's *absent* lines become as readable as its present ones. After this unit
> you can say what a missing `lib` or a missing `moduleResolution` currently means,
> predict what setting one will silently remove, and recognise the one line in a
> typical config that is doing nothing at all.

## 1. Two couplings, one shape

Four options, and only two of them are usually written down. The other two get
values anyway:

```
target  ──chooses──▶  lib
module  ──chooses──▶  moduleResolution
```

Both arrows behave identically, and the shape is worth stating before either
instance:

> An option that is **not set** is not inert. It has a value, derived from
> another option. Setting it does not extend that value — it **replaces** it.

You have already seen a third arrow of the same kind in unit `01`: `target`
chooses `useDefineForClassFields`, which is why moving from es2021 to es2022
changed whether an inherited setter ran. Three instances is enough to call it a
pattern rather than a quirk: **TypeScript derives defaults from your most
load-bearing declarations, and the derivation is invisible in the file.**

## 2. `target` chooses `lib`

`Object.fromEntries` arrived in es2019. With `lib` unset:

```
target es2018  → TS2550: Property 'fromEntries' does not exist on type
                 'ObjectConstructor'. Do you need to change your target
                 library? Try changing the 'lib' compiler option to
                 'es2019' or later.
target es2019  → OK
target esnext  → OK
```

`target` is an *emit* option (unit `00`), and here it is deciding a *check*. It
does so indirectly, by selecting `lib.<target>.full.d.ts` when `lib` is silent.

Break the coupling and the two separate again:

```
target es2018 --lib es2019  → OK
```

The output is still es2018 syntax. The check now believes in es2019 APIs. That is
the honest configuration for a runtime with old syntax support and a polyfill —
and it is unreachable as long as you let `target` speak for `lib`.

Note the error message. It says *"change your target library"* and names `lib`,
not `target`. The compiler is pointing at the option that actually decides,
which is a useful habit to copy: when an API is missing, the question is never
"is my target high enough".

## 3. `module` chooses `moduleResolution`

Same shape, different mechanism. With `moduleResolution` unset, each `module`
value implies a resolver. Two probes distinguish them: whether an extensionless
relative specifier is accepted, and which branch of a conditional `exports` map
gets taken.

| `module` | extensionless `"./dep"` | `exports` branch | implied resolver |
| -------- | ----------------------- | ---------------- | ---------------- |
| `commonjs` | accepted | `require` | bundler-like |
| `es2015` / `es2020` / `es2022` / `esnext` | accepted | `import` | bundler-like |
| `preserve` | accepted | `import` | bundler-like |
| `node16` / `node18` / `node20` / `nodenext` | **rejected** (TS2835) | `import` | Node |

The split is binary: **the Node family implies Node resolution; everything else
implies bundler-style resolution.** There is no third behaviour, because there is
no third resolver left — `node10` and `classic` were removed (unit `04` §2).

`commonjs` is the row worth pausing on. It takes the `require` branch of an
`exports` map, correctly, while still accepting extensionless specifiers. That is
not Node's CommonJS algorithm exactly; it is the bundler resolver making the
condition choice that the emitted format implies. Close enough for most work, and
worth knowing it is a model rather than the thing itself.

## 4. Replace, not merge

The property that turns a coupling into a bug.

Unit `02` showed it for `lib`: with `target: esnext` and `lib` unset, the loaded
chain ends in `lib.esnext.full.d.ts`, which brings DOM, DOM.Iterable,
DOM.AsyncIterable, WebWorker.ImportScripts and ScriptHost. Write
`"lib": ["esnext"]` and **six files leave the program**. You added a value and
removed five capabilities.

Concretely, in a Node project, that one line is why `console.log` suddenly stops
resolving — the DOM declarations had been quietly supplying it, and now they are
gone. The repair is `"types": ["node"]`, not putting `dom` back.

The same rule applies to `moduleResolution`. A project on `module: esnext` that
has been resolving extensionless specifiers all along is using the bundler
resolver by default; write `"moduleResolution": "nodenext"` and you have not
tightened one thing, you have adopted a different algorithm — and TS5110 will
additionally force `module` to change, which changes your emit.

> **The rule for both:** if you set it, you own the whole value. There is no
> "default plus one".

## 5. The line that does nothing

The most common tsconfig pairing in modern projects:

```json
"module": "nodenext",
"moduleResolution": "nodenext"
```

The second line has no effect. `module: nodenext` already implies exactly that
resolver — the table in §3 was produced with `moduleResolution` unset, and the
Node rows behave identically to the explicit setting.

That does not make it wrong to write. It makes it **documentation**: a reader
sees the resolution model stated rather than inferred, and inference is the thing
this unit exists to warn about. Keep it, and know which of the two lines is
load-bearing — because if someone later changes `module` to `esnext` for a
bundler, that inert line becomes an error rather than a silent behaviour change.

Which is an argument for writing it. A redundant declaration that turns a silent
change into a loud one is worth its space.

## 6. The combinations the compiler refuses

```
$ tsc --module esnext --moduleResolution node16 x.ts
error TS5110: Option 'module' must be set to 'Node16' when option
'moduleResolution' is set to 'Node16'.
```

The Node resolvers demand their matching `module`, and refuse to be combined with
anything else.

The justification is in unit `04` §4: under those values, resolution *depends on*
the per-file module format, so a config claiming Node's resolution while emitting
some other format would describe a machine that cannot exist. TypeScript declines
to model it.

Notice what this is. It is the **only place in this course where the compiler
checks one of your host claims against another.** It cannot tell whether `lib`
matches your runtime, or whether `target` matches your consumers, or whether a
bundler is really downstream. It can tell that two of your four claims are
internally inconsistent, and it does. Everywhere else you are unsupervised.

## 7. Reading a config's silences

The practical payoff. Given this:

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

...you can now state what is *not* written:

- **`lib` is `["esnext"]` plus the browser.** DOM, DOM.Iterable,
  DOM.AsyncIterable, WebWorker.ImportScripts, ScriptHost — via
  `lib.esnext.full.d.ts`. If this is a Node package, the compiler is checking it
  against a browser.
- **`types` is whatever the `@types` resolution rules produce**, which unit `02`
  §7 records as genuinely unclear. Write it explicitly.
- **`useDefineForClassFields` is `true`**, because `target` is at es2022 or above.
  Class fields use define semantics and will shadow inherited accessors.
- **`moduleResolution` is doing nothing** (§5), and the emitted format is decided
  per file by `package.json` `"type"` and extensions — none of which is visible in
  this file.

Four lines written; four consequential decisions taken elsewhere. That is the
skill unit `06` drills.

## 8. What this sets up

You have the four options and the wiring between them. Unit `06` is practice:
configs you have not seen, read cold, predictions checked against a compiler.

One thing to carry in: **the interesting part of a config is usually what it does
not say.** The lines that are present were chosen by someone. The lines that are
absent were chosen by the derivation rules in this unit, and nobody reviewed
them.

## References

- [TSConfig — `lib`](https://www.typescriptlang.org/tsconfig/#lib) and
  [`target`](https://www.typescriptlang.org/tsconfig/#target)
- [TSConfig — `moduleResolution`](https://www.typescriptlang.org/tsconfig/#moduleResolution)
- [TypeScript Handbook — Modules reference, "Module resolution"](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- All output in this unit produced with TypeScript 7.0.2 on Node 24.18.0.
