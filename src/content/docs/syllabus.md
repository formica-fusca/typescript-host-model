---
title: Syllabus
description: The eight units, why they run in this order, and the topics deliberately left out.
sidebar:
  order: 2
---

The syllabus. The order is the argument. This page is the authority on what the course
contains, why the units run in this sequence, and what was deliberately left out.

## The units

| # | Unit | Teaches |
| - | ---- | ------- |
| 00 | [`three-jobs-of-tsc`](../units/00-three-jobs-of-tsc/) | That `tsc` does three separable jobs per file — **resolve**, **check**, **emit** — and that the four options do not distribute evenly across them. Two of them change no output byte, watched directly in a four-way emit diff. Defines *host*, and defuses the collision with `CompilerHost`. Ends on the seam: `tsc` never rewrites a specifier. |
| 01 | [`target-the-syntax-level`](../units/01-target-the-syntax-level/) | The legal values, and the removal of `es5` / `es3`. Downlevelling as a syntax rewrite, read out of the emitted file. The hard limit: `?.` downlevels, `findLast` does not appear. Where the rewrite stops being cosmetic (`#private` becomes a `WeakMap`) and the es2022 cliff where one `target` line changes whether an inherited setter runs. |
| 02 | [`lib-the-unverified-promise`](../units/02-lib-the-unverified-promise/) | `lib` as a claim nothing verifies — a `--strict` green build throwing `ReferenceError: Temporal is not defined`. The default nobody set: `target` selects `lib.<target>.full.d.ts`, shipping the DOM into Node projects, shown via `--listFiles`. Replace-not-merge. Why `console` is not JavaScript. `lib` versus `types`, and one documented rule the probes contradict. |
| 03 | [`module-the-emitted-format`](../units/03-module-the-emitted-format/) | The three families of value and what each permits (`import.meta`, top-level `await`). Then the jump: `node16`/`nodenext` are a **delegation** — identical flags, identical source, different output, because `package.json` `"type"` changed. Extension beats `package.json`. `preserve`, for when something downstream owns the decision. |
| 04 | [`module-resolution-finding-the-file`](../units/04-module-resolution-finding-the-file/) | Resolution as a lookup algorithm you are choosing. The surviving values and the TS5108 removal of `node10`/`classic`, which closes a bug class by deletion. `exports` condition selection proved to depend on the *importing* file's format. The extension rule, and why a `.ts` file imports `./thing.js`. What `bundler` relaxes, and the TS5110 pairing constraint. |
| 05 | [`the-couplings`](../units/05-the-couplings/) | The two arrows — `target` → `lib`, `module` → `moduleResolution` — measured rather than asserted, including a table of what each `module` value implies. Replace-not-merge as the property that turns a coupling into a bug. The line in the most common modern config that does nothing. Reading a config's silences. |
| 06 | [`reading-a-config-cold`](../units/06-reading-a-config-cold/) | Practice. Four configs, four questions each, answers folded away. A published Node library (the DOM trap, from a real repo), a bundled app that emits nothing, the most-published tsconfig on the internet (which no longer compiles), and a polyfilled app where `lib` correctly sits *above* `target`. Ends in a checklist. |
| 07 | [`when-the-model-is-wrong`](../units/07-when-the-model-is-wrong/) | The failure taxonomy, worked from symptom back to the false claim. A library's `target` as a promise about other people's parsers. Two hosts over one tree, with the reconciliation rules. The build step that disappears. The description that rots (`baseUrl`, removed in 7). Then the shape beyond TypeScript — Dockerfiles, lockfiles, provider blocks. |

## Planned

None. The course is complete at eight units.

The runnable case study, [`case-studies/host-mismatch/`](../case-study/),
is in place. It is course *material* rather than a unit, which is why it is not
numbered here.

## Why this order

The spine is **install the model, then break it deliberately.**

- `00` first because it is the only unit that is not about an option. It replaces
  "these four configure the build" with a three-column table, and every later unit
  places its option in a column. A reader who already separates resolve/check/emit
  can skim it and lose nothing.
- `01` opens the four because `target` is the only one whose effect you can *see* —
  read the emitted file and the lesson is finished. That establishes the method
  the rest of the course uses: look at the artefact, do not trust the description.
- `02` must follow `01`, because `lib`'s default is derived from `target`.
  Teaching it first would mean forward-referencing the thing that decides it. It
  also lands the course's central property — a claim nothing verifies — on the
  option where it is most visible.
- `03` and `04` are a pair and must run in that order: `nodenext` resolution is
  *illegal* without the matching `module`, and the per-file format that `03`
  establishes is an **input** to the algorithm `04` describes. Reversing them
  would require explaining resolution over a format that has not been decided yet.
- `05` cannot come earlier: a unit about how two options select two other options
  needs all four already present. It is deliberately late and deliberately short.
- `06` before `07` because prediction is easier than diagnosis. Reading a working
  config cold uses the whole model with nothing broken; only once that is
  comfortable does a symptom-first unit have anything to hang on.
- `07` last because it is the only unit that answers "so what", and the only one
  that generalises past `tsconfig.json` — its real subject is describing an
  environment to a tool that cannot check the description, which is the same
  shape as a Dockerfile, a lockfile, or an infrastructure declaration.

Units `01`–`04` are one option each and correspond to one column of the
flip-one-option matrix in `case-studies/host-mismatch/`. `00`, `05`, `06` and `07`
are the connective tissue that makes them add up to a model.

## Deferred

- **Full CJS/ESM interop** — default-import shapes, `esModuleInterop`, the
  dual-package hazard, `require(esm)`. The course needs exactly one rule from this
  territory (which format a file gets, and from what), and takes only that. The
  rest is runtime semantics rather than host description: it would roughly double
  the prerequisites and shift the subject from *what did you tell the compiler* to
  *what does Node do at load time*. Left explicitly **open** as a future course.
  Nearest existing material: `lib/2025-12-28_mts-extension-and-module-resolution`
  and `lib/2025-12-26_inversify-dual-package-hazard`.
- **`paths` and `baseUrl`** — resolution-adjacent, and genuinely tempting to fold
  into `04`. Kept out because they are an *override* applied on top of an
  algorithm, not a description of a host, and mixing the two blurs the one idea
  the course is organised around. They also carry a trap of their own — they are
  invisible to every runtime and most bundlers, so they can make `tsc` agree with
  a host that will never agree back. That trap deserves its own treatment, and
  `07` names it without teaching it.
- **`strict` and the type-checking flags** — they constrain the code you may
  write. They say nothing about the machine that will run it, so they fail the
  membership test this course uses.
- **`composite`, project references, declaration maps, `outDir` / `rootDir`** —
  build orchestration and output placement. Adjacent in the same file, unrelated
  in subject. Existing material: `lib/2026-05-11_yarn-packages-tsconfig-references`
  and `lib/2026-06-28_typescript-declaration-maps-explained`.
- **Bundler configuration** — the course cares that a bundler *is* a host with its
  own resolution rules, and stops there. Configuring one is a different subject.
