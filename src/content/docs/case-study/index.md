---
title: The exercise
description: A runnable two-package workspace. Six prediction questions, then a flip-one-option matrix that shows which claim each compiler option was making.
sidebar:
  order: 0
---

The code lives in [`case-study/`](https://github.com/formica-fusca/typescript-host-model/tree/main/case-study) in this repository. Work it before reading the units — either clone it, or
**[open it in CodeSandbox](https://codesandbox.io/p/devbox/github/formica-fusca/typescript-host-model/main)**, which boots a Linux VM with the real
toolchain rather than a browser emulation, so the results match the ones
printed here.


One package that describes a host correctly, one that describes several hosts
that do not exist, and a matrix that flips a single compiler option at a time to
show which claim each one was making.

```
case-study/
├── packages/
│   ├── dual-lib/    a published-shaped package: conditional exports, no build step
│   └── consumer/    the reference config — the one description here that is true
└── experiments/
    └── run.mjs      six variants, each differing from its pair by ONE option
```

This is the exercise. Work it **before** reading the units. Nothing here is
difficult; it is invisible until a thing you believed turns out to be false, and
being wrong first is the whole mechanism.

## Setup

```bash
npm install
```

Node 24+ and nothing else. TypeScript and `@types/node` are the only
dependencies; the assertions are `node:test` and `node:assert`.

Verified on **Node v24.18.0** and **TypeScript 7.0.2**, from a clean checkout.

## The exercise

**Read `packages/consumer/src/index.ts` and both `package.json` files first.**
About forty lines. Then write your answers down before running anything.

1. `packages/consumer/tsconfig.json` writes `"lib": ["es2024"]`. Suppose it did
   not, and left `lib` to be derived from `target`. Would
   `document.querySelector("div")` type-check in a package that will only ever
   run in Node?

2. `lib: ["esnext"]` declares that `Temporal` exists. `tsc --strict` passes. What
   happens when you run the output on Node 24?

3. The consumer sets `"module": "nodenext"`. If you changed **nothing** in any
   tsconfig, and only edited `"type"` in `packages/consumer/package.json`, would
   the emitted JavaScript change?

4. `src/index.ts` imports `"./describe.js"` — a `.js` specifier written inside a
   `.ts` file, for a file that does not exist under that name. Why is that
   correct, and what happens if you write `"./describe"` instead?

5. `dual-lib` exposes two branches through its `exports` map, one typed
   `"ESM-branch"` and one typed `"CJS-branch"`. Which one does the consumer
   resolve — and what, exactly, decides it?

6. `src/index.ts` uses `[1, 2, 3].at(-1)` (an es2022 API) and `opt.n ?? 0`
   (es2020 syntax). Lower `target` to `es2018` and hold `lib` at `es2024`. Which
   of those two lines changes in the output?

Write all six down. Then:

## Run

```bash
npm run build        # type-check and emit the reference consumer
npm run experiments  # the matrix — six experiments, printed as observations
npm test             # the same six, as assertions
```

`npm run build` is not a preliminary step. It is the one configuration in this
case study that describes a host that exists, and it produces working output:

```
flavour=ESM-branch last=3 value=0
```

`npm run experiments` prints what each flipped option actually did. `npm test`
states what those observations **must** be — so if a future compiler changes one
of these answers, the suite is what tells you. That matters more here than
usual: two of the values these experiments exercise were *removed* from the
compiler within recent versions. A case study about describing hosts should
notice when its own host moves.

## The analysis

The correction is [the answers](answers/) — a standalone document settling all
six questions, readable without the code open.

Work the matrix first. `ANSWERS.md` explains *why* each result is what it is, and
that explanation is worth much less if you have not yet been surprised by one.

## How the experiments work

`experiments/run.mjs` writes a self-contained variant directory under
`experiments/.work/` for each arm of each experiment — its own `package.json`,
its own `tsconfig.json`, its own sources — then compiles it and records the
result. Variants are pairs: the two arms differ by exactly **one** option, so
anything that changes is attributable.

Two details are deliberate:

- **Variants get no `node_modules` of their own.** They sit inside this
  workspace, so resolution walks up and finds `dual-lib` exactly the way any file
  in the repo would. That is the behaviour experiment 5 is measuring.
- **`.work/` is git-ignored and rewritten on every run.** There is no state to
  stale, and nothing to clean up by hand.

## Provenance

Built for the course
this course. Experiment 1 is a
real finding, not a constructed one: it was observed in a production monorepo
whose Node-only packages type-check against the DOM for exactly this reason.
