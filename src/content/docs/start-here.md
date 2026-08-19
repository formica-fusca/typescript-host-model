---
title: How to take this course
description: Prerequisites, what is in and out of scope, and the method — prediction first, every claim probed against a real compiler.
sidebar:
  order: 1
---

## Prerequisites

You have written or edited a `tsconfig.json` and run `tsc`. You know that ESM and
CommonJS both exist and that `import` and `require` are their surface syntax.

Helpful but taught where needed: what a `package.json` `"exports"` map is, and
what a bundler does. Both are built up from the code where the course needs them.

Explicitly **not** assumed: bundler internals, monorepo tooling, project
references, or any knowledge of TypeScript's type system beyond using it. Nothing
in this course is about types. It is about the compiler's model of a runtime.

Node 24.18.0 and a terminal, if you want to run the case study, which you should.

## Scope

**In:** the four options and their real value sets, taken from the compiler
rather than from documentation; the two implicit-default couplings (`target`
selects `lib`, `module` selects `moduleResolution`) and the fact that both
**replace** rather than merge; `lib` versus `types`, which are different
mechanisms that both add declarations; the per-file module format that `node16` /
`nodenext` delegate to `package.json` and the file extension; `node16` /
`nodenext` versus `bundler` resolution and the role of the `"exports"` map;
values removed in recent compilers; and the failure taxonomy that follows from
none of these claims being checked.

**Out:** `strict` and the type-checking flags — they constrain your code, not the
host. `outDir` / `rootDir`. `composite`, project references and declaration maps.
Bundler configuration itself. And the type system generally: no generics, no
conditional types, no inference.

Two topics are **deliberately deferred** rather than absent, and
[`docs/README.md`](docs/README.md) says why: full CJS/ESM interop, and
`paths` / `baseUrl`.

## Method

Prediction first. The case study poses its questions before it shows its answers,
and reading a unit before you have been wrong about its subject wastes the unit.

Then the units, which exist to explain the gaps. They are **cumulative** — each
assumes the vocabulary built by the ones before.

Every claim in this course is checked against a real compiler, pinned to
**TypeScript 7.0.2** on **Node 24.18.0**, and the units show the probe rather
than assert the conclusion. This is not ceremony: while scoping this course, one
value list had to be re-verified across a compiler version, and the location of
the `lib.*.d.ts` files on disk turned out to have moved between TypeScript 6 and
7 — from `typescript/lib/` to a platform-specific package,
`@typescript/typescript-<platform>/lib/`. Assertions about this subject rot in
about a year.

Where a claim is version-dependent, the unit says which compiler produced the
output.

## Further reading

These are notes kept elsewhere; they are useful but not prerequisites, and the
course does not depend on them.

- **`.mts` extensions and ESM module resolution** — how Node decides a file's
  module format. This course states the rule; that note works through it.
- **What puts a file in a TypeScript program** — program membership, which is
  the question `moduleResolution` answers one edge of.
- **The dual-package hazard** — one concrete way two hosts disagreeing about one
  tree goes wrong.
