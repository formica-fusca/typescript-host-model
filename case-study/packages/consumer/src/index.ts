// Every line here is load-bearing for one of the six experiments.
//
// Note the `.js` on a relative import from a `.ts` file. That is not a typo and
// not a convention: `moduleResolution: nodenext` models Node's ESM rule, where a
// specifier is a URL with no extension-guessing step, and `tsc` copies the
// specifier into the output verbatim. You are naming the file your *output* will
// import from. Experiment 4 removes it and shows what happens.
import { describe } from "./describe.js";

// Resolved through dual-lib's conditional `exports` map. Which branch you get
// depends on whether the compiler considers THIS file ESM or CommonJS, which is
// decided by `"type": "module"` in this package's package.json. Experiment 5.
import { flavour } from "dual-lib";

// An es2022 API. `lib` decides whether this type-checks; `target` has no opinion
// about it and will never polyfill it. Experiment 6.
const last = [1, 2, 3].at(-1);

// es2020 syntax. `target` rewrites this when the host's parser is older.
// Experiment 6 again — the same line pair separates syntax from API.
const opt: { n?: number } = {};
const value = opt.n ?? 0;

console.log(describe({ flavour, last, value }));
