# Describing the host

A course on the four TypeScript compiler options that describe a runtime —
`target`, `lib`, `module` and `moduleResolution` — and what happens when the
description is wrong.

**Published at** <https://formica-fusca.github.io/typescript-host-model/>

Four lines sit near the top of almost every `tsconfig.json`, and almost nobody
chose them. They are read as a settings group about *output*, which is wrong for
half of them: flip `lib` between `es2015` and `esnext` and the emitted JavaScript
is byte-identical. They are not build settings. They are a description of a
machine that is not present, and the compiler believes every word of it.

## Layout

```
src/content/docs/     the course — Astro + Starlight
├── index.mdx           landing
├── start-here.md       prerequisites, scope, method
├── syllabus.md         the eight units, their order, and what was left out
├── case-study/         the exercise and its answers
└── units/              00 … 07, cumulative
case-study/           the runnable workspace the exercise refers to
├── packages/dual-lib/  a published-shaped package: conditional exports, no build
├── packages/consumer/  the one config here that describes a host that exists
└── experiments/        six paired variants, one compiler option apart
```

The prose and the code are separate on purpose. `src/content/docs/` is read;
`case-study/` is run. Only the second carries a reproducibility obligation.

## Running it

The docs app:

```bash
npm install
npm run dev       # local site at http://localhost:4321/typescript-host-model/
npm run build     # static output to dist/
npm run check     # type-checks content against Starlight's schema
```

The case study is a **separate npm workspace** with its own lockfile, because it
pins a different TypeScript on purpose — every result in the course was verified
against it:

```bash
cd case-study
npm install
npm run build        # type-check and emit the reference consumer
npm run experiments  # the matrix, printed as observations
npm test             # the same six, as assertions
```

Verified on **Node v24.18.0** and **TypeScript 7.0.2**.

> The docs app resolves its own, older TypeScript — `@astrojs/check` constrains
> it. That version has nothing to do with the course's claims; `case-study/`
> pins 7.0.2 independently and is the only thing the course's results depend on.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs three jobs:

| Job | Does | Runs on |
| --- | ---- | ------- |
| `case-study` | `npm ci`, build, run, and the six assertions | every push and PR |
| `build` | `astro check` then `astro build`, uploads the Pages artifact | every push and PR |
| `deploy` | publishes to GitHub Pages | `main` only, after **both** of the above |

The deploy depends on the case study, not just the docs build. Publishing a site
that documents commands which no longer run is the specific failure that
ordering exists to prevent.

`npm ci` rather than `npm install`: it installs exactly the lockfile and fails if
the two have drifted, which is the check worth having on a case study whose whole
point is reproducibility.

Node is pinned to `24.18.0` in CI rather than floating on `lts/*`. Two
experiments assert *runtime* behaviour — that `Temporal` is absent, and that an
ESM specifier is not extension-guessed — and a future release could move either.
When that happens this repository should fail loudly, which is the same argument
the course makes about `tsconfig.json`.

## The `satteri` override

`package.json` carries this:

```json
"overrides": {
  "@astrojs/markdown-satteri": { "satteri": "0.10.3" }
}
```

It is not cargo-cult. Without it, `npm ci` fails:

```
npm error Missing: @bruits/satteri-darwin-arm64@ from lock file
npm error Missing: @bruits/satteri-linux-x64-musl@ from lock file
```

`satteri@0.10.4` declares nine optional platform packages, and **two of them were
never published** — `@bruits/satteri-darwin-arm64` stops at `0.10.3`, and
`0.10.4` returns a 404 from the registry. `npm install` tolerates that, because
an optional dependency is allowed to fail; the lockfile therefore records seven
of nine. `npm ci` then compares the tree against the lock, finds the two absent,
and refuses to install.

The version arrives through
`@astrojs/starlight → @astrojs/markdown-satteri@0.3.7 → satteri@0.10.4`. The
override pins **only that path** to `0.10.3`, which has all nine variants
published. Starlight's own direct `satteri@0.9.5` is complete and is deliberately
left alone.

**Remove this override once `satteri@0.10.5` (or any later complete release)
ships.** Check with:

```bash
npm view @bruits/satteri-darwin-arm64 versions --json
```

If the version `@astrojs/markdown-satteri` wants appears in that list, the
override has done its job and can go.

## Deploying

GitHub Pages must be set to **GitHub Actions** as its source
(Settings → Pages → Build and deployment → Source). The workflow needs no
`gh-pages` branch and no `PAT`; it uses the `github-pages` environment with
`id-token: write`.

Because this is a *project* page, the site is served from a sub-path, and
`astro.config.mjs` sets `base: "/typescript-host-model"` to match. Astro does not
rewrite absolute links written by hand in markdown, so pages in
`src/content/docs/` link to each other **relatively** — base-agnostic, and they
survive the site moving.

## Provenance

Every claim in the course was produced by a throwaway file and a compiler
invocation, not from memory. Several first-draft claims did not survive that
check, and one — the behaviour of `@types` auto-inclusion — is recorded in
unit `02` as an open question rather than an answer.

The real-world specimen the course cites throughout is
[`domain-tools`](https://github.com/formica-fusca/domain-tools).

## Licence

MIT.
