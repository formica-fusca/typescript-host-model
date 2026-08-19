---
title: "When the model is wrong"
description: "Symptom back to false claim, two hosts over one tree, and the shape beyond TypeScript."
sidebar:
  order: 7
  label: "07 · When the model is wrong"
---

> **Purpose:** to work the course backwards — from a symptom to the claim that
> produced it — and to handle the case every earlier unit deferred: what to do
> when there is genuinely more than one host and only one config. After this unit
> you can diagnose these failures from the error text alone, and you can say why
> the same shape recurs far outside `tsconfig.json`.

## 1. The taxonomy

Every failure in this course is one sentence: **the description and the host
disagreed.** What varies is which of the four claims was false, and each has a
signature.

| Symptom | Where it fires | False claim |
| ------- | -------------- | ----------- |
| `SyntaxError: Unexpected token` | parse, before any code runs | `target` — the host's parser is older than you said |
| `TypeError: x.findLast is not a function` | first call | `lib` — the API is not there |
| `ReferenceError: Temporal is not defined` | first reference | `lib` — the global is not there |
| `ERR_MODULE_NOT_FOUND` / `Cannot find module` | load | `moduleResolution` — the host's lookup differs from the model |
| `SyntaxError: Cannot use import statement outside a module` | load | `module` — the emitted format is not the format the host expects |
| `TS2307: Cannot find module` in a *consumer's* build | their compile | your published `exports`/types, resolved by *their* resolver |

Two properties of this table are the reason the failures feel mysterious.

**They all fire at runtime, or in someone else's build.** Your own `tsc` was
green in every row. It had to be — the claim it was checking against is the claim
that was wrong.

**The error names the consequence, never the cause.** `Temporal is not defined`
does not mention `lib`; `ERR_MODULE_NOT_FOUND` does not mention
`moduleResolution`. Reading the table in reverse is the skill.

## 2. A library's `target` is a promise about other people

For an application you own end to end, `target` is a local decision: you know the
Node version, you can raise it, and a mistake surfaces in your own CI.

Publish the output and the meaning changes. Your emitted syntax becomes the floor
every consumer's parser must clear, and you will not be present when it fails.
The failure lands in *their* build, phrased as their problem.

So `"target": "esnext"` in a published package is a claim about machines you have
never seen, made by a value that changes on your next compiler upgrade — and a
compiler upgrade is not a release-note-worthy event in most projects. You can ship
a breaking change to consumers by running `yarn upgrade`.

The fix is not complicated; it is just a decision someone has to make:

- pick the oldest runtime you intend to support,
- state it in `engines`,
- set `target` to match, and
- treat raising it as a **major version**, because it is one.

## 3. Two hosts, one tree

The case every earlier unit deferred, and it is the common one in real
repositories.

`domain-tools` type-checks with `tsc -b` under `module: nodenext` /
`moduleResolution: nodenext`, and *publishes* through `tsup`, which bundles with
esbuild for JavaScript and `rollup-plugin-dts` for declarations. The build exists
for a good reason — an internal `private: true` package has to be inlined, and
`tsc` emits one file per input and never inlines anything.

So one source tree is read by two resolvers, and its host is described twice, in
two languages:

```jsonc
// tsconfig.json
"target": "esnext",
"module": "nodenext",
"moduleResolution": "nodenext"
```

```ts
// tsup.config.ts
target: "esnext",
format: ["esm"],
```

Nothing checks that those agree. `target` appears in both files; if one changes,
the other does not follow, and no error is raised by either tool — the second
declaration simply wins for the artefact that ships.

**This is not a defect to fix.** Both tools are needed and both need a host
description. What the situation demands is that the duplication be *known*, and
the reconciliation rules chosen deliberately:

- **Type-check with the strictest model.** `nodenext` requires explicit
  extensions; `bundler` does not. Checking under the strict one and bundling under
  the loose one means the code satisfies both. Reverse it and you ship specifiers
  only your bundler can resolve.
- **Let the last tool own emit.** Whoever writes the shipped file owns `target`
  and `format`. The earlier tool should be checking, not emitting — `noEmit: true`
  makes that explicit and removes the chance of shipping the wrong artefact.
- **Write the duplication down.** A comment in each file naming the other is the
  cheapest possible defence, and the only one that survives someone else editing
  it. `domain-tools` does this: `tsup.config.ts` opens with a comment explaining
  why `tsc` is not the builder, and `CLAUDE.md` warns that a green test run is no
  evidence `dist` is current, because tests compile to a *different output
  directory* than the one that ships.

That last point generalises past this course and is worth stating plainly: **when
two pipelines compile the same source, a green run of one says nothing about the
other.**

## 4. The build step that disappears

`"moduleResolution": "bundler"` is the only value in this course that is a claim
about **your own repository** rather than about a runtime. It says: something
downstream will resolve these specifiers.

That claim has a lifespan. The build step gets simplified, a package is extracted,
a script starts running `tsc` output directly — and now extensionless specifiers
reach Node, which does not guess extensions (unit `04` §5). The config still says
`bundler`. It is still green. It has been describing a machine that no longer
exists since the day the build step went away.

There is no compiler check for this, because from the compiler's side nothing
changed. The defence is documentary: if a config depends on a build step, the
config should say which one.

## 5. The description that rots

The last failure mode is the description staying still while the world moves.

Two of the four options have had values **removed** in recent compilers:

```
Option 'target=ES5' has been removed. Please remove it from your configuration.
Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
```

Neighbouring options are on the same path. `baseUrl` is deprecated in TypeScript
6 and gone in 7:

```
TS 6.0.3 → TS5101: Option 'baseUrl' is deprecated and will stop functioning
                   in TypeScript 7.0.
TS 7.0.2 → TS5102: Option 'baseUrl' has been removed.
                   Use '"paths": {"*": ["./*"]}' instead.
```

This has a practical edge for anyone in the position of §3. `tsup` injects
`baseUrl` into the compiler options it uses for the declaration bundle. On
TypeScript 6 that is silenceable with `"ignoreDeprecations": "6.0"`. On
TypeScript 7 it is not — a removed option is not a deprecated one, and the
silencing flag has nothing left to silence. A config that is merely *noisy* today
becomes a hard failure on upgrade, and the injecting tool is not yours to edit.

The habit that survives all of this is the one from unit `01`: **ask the compiler,
not the documentation.** `--target BOGUS` takes three seconds and cannot be out of
date. Any table — including every table in this course — is a snapshot, and the
snapshot has a date on it for that reason.

## 6. What to actually do

Six practices, in rough order of payoff:

1. **Write `lib` explicitly.** It is the highest-consequence derived default, and
   the derivation ships a browser into Node projects. One line.
2. **Write `types` explicitly.** Do not rely on auto-inclusion (unit `02` §7).
3. **Type-check under the strictest host you have.** If Node loads any of it, use
   the Node resolver. Satisfying the strict model satisfies the loose one; the
   reverse is false.
4. **Give emit exactly one owner.** `noEmit: true` in the config of any tool that
   is only checking.
5. **Pin `target` to a runtime you can name**, and treat it as a support
   commitment in anything published.
6. **Re-verify on compiler upgrades.** Not the whole config — just the four lines
   this course is about, plus whatever a tool injects on your behalf.

## 7. The shape, beyond TypeScript

Strip the specifics and this course was never really about `tsconfig.json`:

> A tool must act on an environment it cannot inspect. So it acts on a
> **description** you supply. The description is not validated against the
> environment, and drifts from it silently — because the whole point of the
> description was that the environment was not available to check.

You have met this before. A Dockerfile's base image tag describes a filesystem
that is assembled elsewhere. A lockfile describes a dependency graph that a
registry could serve differently. An IaC provider block describes an API whose
behaviour is versioned on someone else's schedule. Each of them is green until the
described thing and the real thing part company.

Which suggests the general defences, and they are the ones in §6 wearing different
clothes: **prefer explicit values to derived ones**, because a derived value is
one nobody reviewed. **Prefer the strictest model** when several consumers exist,
because strict-satisfies-loose is one-directional. And **re-verify on upgrade**,
because the failure is silent by construction — nothing will tell you.

## 8. End of the course

You can now read the four lines, state the host they describe, name what the
absent lines were set to on your behalf, and work backwards from a symptom to the
claim that produced it.

The one habit worth more than any fact here: when you are unsure what a config
does, **do not reason about it — probe it.** Every claim in these eight units was
produced by a throwaway file and a compiler invocation, several of them
overturning what the author expected, and one of them (`@types` auto-inclusion,
unit `02` §7) still standing as an open question rather than an answer.

Three seconds with `--listFiles` beats an hour of confident recall, including
this course's.

## References

- [TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- [Node.js — Modules: Packages](https://nodejs.org/api/packages.html)
- [`domain-tools`](https://github.com/formica-fusca/domain-tools) — the
  two-hosts-one-tree example in §3, `tsup.config.ts` and `CLAUDE.md`.
- All output in this unit produced with TypeScript 7.0.2 and 6.0.3 on Node
  24.18.0.
