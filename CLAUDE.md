# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A **published course**, not a library or an app. It teaches that `target`, `lib`,
`module` and `moduleResolution` are not build settings but a _description of a
runtime host_ which the compiler believes without ever verifying. The deliverable
is an Astro + Starlight site, plus a runnable case study that proves every claim
the prose makes.

The governing rule: **the prose is read, the case study is run, and only the
second carries a reproducibility obligation.** Claims in `src/content/docs/` were
produced by running a real compiler, never written from memory.

## Two workspaces, deliberately not linked

```
/                 docs app — Astro + Starlight, TypeScript ^6.0.3
case-study/       separate npm workspace, own lockfile, TypeScript 7.0.2 pinned
```

`npm install` at the root does **not** install `case-study/`. They pin different
TypeScript versions on purpose, and the root `tsconfig.json` excludes
`case-study` — type-checking it from the root would check the course's code
against a different host description than the course specifies, which is exactly
the mistake unit 07 is about.

Install both explicitly (this is what the devcontainer's `postCreateCommand`
does):

```bash
npm ci && npm --prefix case-study ci
```

## Commands

Docs app, from the root:

```bash
npm run dev      # http://localhost:4321/typescript-host-model/ (note the base path)
npm run build    # static output to dist/
npm run check    # astro check — validates frontmatter against Starlight's schema
npm run case-study   # proxy for `npm --prefix case-study test`
```

Case study, from `case-study/`:

```bash
npm run build        # tsc -p packages/consumer → dist/, then `node packages/consumer/dist/index.js`
                     # must print: flavour=ESM-branch last=3 value=0
npm run experiments  # the flip-one-option matrix, printed as observations
npm test             # the same six, as node:test assertions
```

Running one assertion:

```bash
node --test --test-name-pattern '^2 —' experiments/matrix.test.mjs
```

Note this filters _assertions only_. `matrix.test.mjs` calls `runAll()` at module
top level, so every variant is still generated and compiled regardless of the
pattern. There is no way to compile just one experiment short of editing the
`experiments` array in `run.mjs`.

## Architecture

### `src/content/docs/` — the course

`index.mdx` (splash), `start-here.md`, `syllabus.md`, `case-study/`, and
`units/00`–`07`. Units are **cumulative**: each assumes vocabulary built by the
ones before, and each ends with `## What this sets up` naming the next.

`syllabus.md` is the **authority** on what the course contains, the unit order,
the rationale for that order, and what was deliberately deferred. Adding,
removing or reordering a unit means updating `syllabus.md` in the same change, or
the course's own index is lying.

### `case-study/` — the runnable proof

```
packages/dual-lib/   hand-written, no build step; conditional `exports` map
packages/consumer/   the one config here that describes a host that exists
experiments/run.mjs           six paired variants — observes, never asserts
experiments/matrix.test.mjs   the same six — asserts what the observations must be
```

`dual-lib` types its two branches with different string literals (`"ESM-branch"`
vs `"CJS-branch"`) on purpose: that is the measuring instrument. A consumer
annotated `const picked: "ESM-branch" = flavour` produces **TS2322** when the
compiler took the `require` branch, which turns "which file did resolution pick"
into a machine-checkable fact.

`run.mjs` generates each variant into `experiments/.work/<id>/` — its own
`package.json`, `tsconfig.json` and sources — compiles it, and records the result.
Two properties are load-bearing:

- **Variants get no `node_modules` of their own.** They sit inside the workspace
  so resolution walks _up_ and finds `dual-lib` the way any file in the repo
  would. That is the behaviour experiment 5 measures.
- **`.work/` is git-ignored and rewritten on every run.** Never edit it; edit the
  `experiments` array in `run.mjs`.

`compile()` throws if `tsc` exits non-zero with **zero** `TS\d+` diagnostics.
This is not defensive noise: TypeScript 7 ships `.bin/tsc` as a Node shim that
spawns a platform-specific native binary, so the shim can be perfectly runnable
while the binary is missing — and the observed failure was all six experiments
returning empty results that looked like clean builds. "tsc found no diagnostics"
and "tsc never ran" must never look alike. `assertToolchain()` fails loudly,
once, before any experiment runs.

Adding an experiment means editing **both** `run.mjs` (the observation) and
`matrix.test.mjs` (what it must be).

## Conventions that are easy to break

- **Markdown links between doc pages must be relative.** The site is a GitHub
  _project_ page served from `/typescript-host-model/`, and Astro does not
  rewrite hand-written absolute links in markdown. Relative links are
  base-agnostic and survive the site moving.
- **Unit frontmatter** carries `title`, `description`, and a `sidebar` block with
  `order` matching the filename number and `label` in the form `"03 · module —
the emitted format"`. Sidebar entries are autogenerated from the directory, so
  a missing `order` silently reorders the course.
- **Unit body structure**: numbered `## 1.`, `## 2.` … sections, ending with
  `## What this sets up` and `## References`. The References block names the
  compiler and Node version that produced the unit's output.
- **`case-study/README.md` and `case-study/ANSWERS.md` are mirrored** into
  `src/content/docs/case-study/index.md` and `answers.md`. The copies diverge
  deliberately — frontmatter replaces the H1, Starlight `:::caution` asides
  replace the hand-rolled table of contents, and repo-relative links are dropped
  or relativised. Editing one side requires editing the other.
- **Version pins are claims, not conveniences.** Node `24.18.0` appears in
  `.devcontainer/devcontainer.json` and both CI jobs; TypeScript `7.0.2` is
  pinned in `case-study/package.json`. Two experiments assert _runtime_
  behaviour — that `Temporal` is absent, and that an ESM specifier is not
  extension-guessed — which a future release could move. When it moves this
  repository should fail loudly. Do not float these to `lts/*` or a caret range.
- **`npm ci`, never `npm install`, in CI and the devcontainer.** It installs
  exactly the lockfile and fails on drift, which is the check worth having on a
  case study whose whole point is reproducibility.

## Changing a documented claim

Every output shown in the course came from a real compiler invocation. If you
change a claim, a config sample, or an expected result:

1. Reproduce it against the pinned toolchain — a throwaway file and a `tsc` run,
   not recall.
2. Update `matrix.test.mjs` if the change touches one of the six experiments.
3. Run `npm test` in `case-study/` and `npm run check` at the root.

Unit 02 records the behaviour of `@types` auto-inclusion as an **open question**
rather than an answer, because the probes contradicted the documentation. Leave
it open unless you have re-probed it.

## CI and deployment

`.github/workflows/ci.yml` runs `case-study` (build, execute the emitted output,
then the six assertions) and `build` (`astro check`, `astro build`, upload Pages
artifact) on every push and PR. `deploy` runs on `main` only and requires
**both**. Publishing a site that documents commands which no longer run is the
specific failure that ordering prevents.

GitHub Pages must be set to **GitHub Actions** as its source. No `gh-pages`
branch, no PAT.

## The `satteri` override

`package.json` pins `@astrojs/markdown-satteri → satteri@0.10.3`. It is not
cargo-cult: `satteri@0.10.4` declares nine optional platform packages and two
were never published, so `npm install` records seven of nine in the lockfile and
`npm ci` then refuses to install. The override pins only that dependency path;
Starlight's own direct `satteri@0.9.5` is complete and deliberately untouched.
The root `README.md` documents the exit condition and the `npm view` command to
check it — remove the override once a complete release ships.
