// The flip-one-option matrix.
//
// Each experiment writes a self-contained variant directory under .work/, runs
// the compiler (and sometimes the output), and records what came back. Nothing
// here asserts — it observes and prints. `matrix.test.mjs` is what turns these
// observations into pass/fail.
//
// Variants deliberately do NOT get their own node_modules. They sit inside this
// workspace, so resolution walks up and finds `dual-lib` the same way any file
// in the repo would. That is the behaviour under test in experiment 5.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORK = join(HERE, ".work");
const TSC = join(ROOT, "node_modules", ".bin", "tsc");

/** Write one variant directory and return its path. */
function variant(id, { files, compilerOptions, type = "module" }) {
  const dir = join(WORK, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: id, type }, null, 2));
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, ...compilerOptions }, include: ["*.ts"] }, null, 2),
  );
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

/**
 * Fail loudly, once, if the toolchain is not usable — before any experiment runs.
 *
 * This exists because of a real failure: on a fresh cloud environment all six
 * experiments failed with EMPTY results ("", "rejected — ", ".at() gone"), which
 * is what `compile()` produced when tsc could not start. "tsc found no
 * diagnostics" and "tsc never ran" are completely different facts and must never
 * look alike. TypeScript 7 makes this easy to hit: `.bin/tsc` is a small Node
 * shim that spawns a platform-specific native binary, so the shim can exist and
 * be perfectly runnable while the binary it needs is absent.
 */
function assertToolchain() {
  if (!existsSync(TSC)) {
    throw new Error(
      `tsc not found at ${TSC}\n` +
        `The case study has its own lockfile. Run:  npm --prefix case-study ci`,
    );
  }
  try {
    const version = execFileSync(TSC, ["--version"], { encoding: "utf8", stdio: "pipe" }).trim();
    return version;
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
    throw new Error(
      `tsc is installed but will not run.\n` +
        `TypeScript 7 ships a native binary per platform; the usual cause is that\n` +
        `the optional dependency for this platform (${process.platform}/${process.arch}) is missing.\n` +
        `Try:  rm -rf case-study/node_modules && npm --prefix case-study ci\n\n` +
        `exit=${e.status}\n${out || e.message}`,
    );
  }
}

/** Compile a variant. Returns { ok, codes } — codes are the TS error numbers. */
function compile(dir) {
  try {
    execFileSync(TSC, ["-p", dir], { encoding: "utf8", stdio: "pipe" });
    return { ok: true, codes: [] };
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const codes = [...new Set(out.match(/TS\d+/g) ?? [])];
    // No diagnostics means this was not a type error — tsc itself failed.
    // Surfacing it as an empty result would silently corrupt every experiment.
    if (codes.length === 0) {
      throw new Error(`tsc failed to run for ${dir}\nexit=${e.status}\n${out.trim() || e.message}`);
    }
    return { ok: false, codes };
  }
}

/** Run an emitted file. Returns the error constructor name, or null if it ran. */
function run(dir, file) {
  try {
    execFileSync(process.execPath, [join(dir, file)], { encoding: "utf8", stdio: "pipe" });
    return null;
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    return out.match(/\b(\w*Error)\b/)?.[1] ?? "unknown";
  }
}

const emitted = (dir, file) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), "utf8") : "");

// ---------------------------------------------------------------- experiments

export const experiments = [
  {
    id: "1-lib-default-ships-the-dom",
    option: "lib",
    question:
      "A Node-only package sets `target: esnext` and never writes a `lib` line. " +
      "Does `document.querySelector` type-check?",
    run() {
      const files = { "a.ts": `export const el = document.querySelector("div");\n` };
      const withoutLib = compile(variant("e1-lib-unset", { files, compilerOptions: { target: "esnext", noEmit: true } }));
      const withLib = compile(variant("e1-lib-esnext", { files, compilerOptions: { target: "esnext", lib: ["esnext"], noEmit: true } }));
      return {
        "lib unset (derived from target)": withoutLib.ok ? "compiles clean" : withoutLib.codes.join(" "),
        'lib: ["esnext"]': withLib.ok ? "compiles clean" : withLib.codes.join(" "),
      };
    },
  },
  {
    id: "2-lib-is-a-claim-nothing-verifies",
    option: "lib",
    question:
      "`lib: [\"esnext\"]` includes lib.esnext.temporal.d.ts. The build is green under --strict. " +
      "What happens when you run it?",
    run() {
      const dir = variant("e2-temporal", {
        files: { "a.ts": `export const stamp = Temporal.Now.instant().toString();\n` },
        compilerOptions: { target: "esnext", lib: ["esnext"], module: "esnext", moduleResolution: "bundler" },
      });
      const compiled = compile(dir);
      return {
        "tsc --strict": compiled.ok ? "GREEN — zero errors" : compiled.codes.join(" "),
        [`node a.js (${process.version})`]: run(dir, "a.js") ?? "ran fine",
      };
    },
  },
  {
    id: "3-module-format-is-delegated",
    option: "module",
    question:
      "Identical compiler flags (`module: nodenext`), identical source. " +
      "Only `package.json` \"type\" differs. What comes out?",
    run() {
      const files = { "a.ts": `export const v = 1;\n` };
      const opts = { target: "es2024", lib: ["es2024"], module: "nodenext", moduleResolution: "nodenext" };
      const out = {};
      for (const type of ["module", "commonjs"]) {
        const dir = variant(`e3-type-${type}`, { files, compilerOptions: opts, type });
        compile(dir);
        const js = emitted(dir, "a.js");
        out[`"type": "${type}"`] = js.includes("exports.v") ? "CommonJS — exports.v = 1" : "ESM — export const v = 1";
      }
      return out;
    },
  },
  {
    id: "4-the-resolver-decides-legality",
    option: "moduleResolution",
    question:
      "`import { d } from \"./dep\"` — no extension — in a `\"type\": \"module\"` package. Legal?",
    run() {
      const files = {
        "dep.ts": `export const d = 1;\n`,
        "a.ts": `import { d } from "./dep";\nexport const y = d;\n`,
      };
      const node = compile(variant("e4-nodenext", {
        files, compilerOptions: { target: "es2024", lib: ["es2024"], module: "nodenext", moduleResolution: "nodenext", noEmit: true },
      }));
      const bundler = compile(variant("e4-bundler", {
        files, compilerOptions: { target: "es2024", lib: ["es2024"], module: "esnext", moduleResolution: "bundler", noEmit: true },
      }));
      return {
        "moduleResolution: nodenext": node.ok ? "accepted" : `rejected — ${node.codes.join(" ")}`,
        "moduleResolution: bundler": bundler.ok ? "accepted" : `rejected — ${bundler.codes.join(" ")}`,
      };
    },
  },
  {
    id: "5-exports-branch-depends-on-the-caller",
    option: "module + moduleResolution",
    question:
      "dual-lib's exports map has an \"import\" branch typed \"ESM-branch\" and a \"require\" branch " +
      "typed \"CJS-branch\". Same import, same flags — which branch does the compiler take?",
    run() {
      const files = {
        "a.ts": `import { flavour } from "dual-lib";\nexport const picked: "ESM-branch" = flavour;\n`,
      };
      const opts = { target: "es2024", lib: ["es2024"], module: "nodenext", moduleResolution: "nodenext", noEmit: true };
      const out = {};
      for (const type of ["module", "commonjs"]) {
        const r = compile(variant(`e5-type-${type}`, { files, compilerOptions: opts, type }));
        out[`consumer "type": "${type}"`] = r.ok
          ? 'took the "import" branch (ESM-branch)'
          : `took the "require" branch — ${r.codes.join(" ")}`;
      }
      return out;
    },
  },
  {
    id: "6-target-rewrites-syntax-never-apis",
    option: "target",
    question:
      "One file with an es2022 API (`.at`) and es2020 syntax (`??`), compiled at two targets, " +
      "`lib` held constant. Which half moves?",
    run() {
      const files = {
        "a.ts": `const o: { n?: number } = {};\nexport const v = o.n ?? 0;\nexport const r = [1, 2].at(-1);\n`,
      };
      const out = {};
      for (const target of ["es2024", "es2018"]) {
        const dir = variant(`e6-target-${target}`, {
          files, compilerOptions: { target, lib: ["es2024"], module: "esnext", moduleResolution: "bundler" },
        });
        compile(dir);
        const js = emitted(dir, "a.js");
        out[`target: ${target}`] =
          `syntax ${js.includes("void 0") ? "REWRITTEN" : "untouched"}, ` +
          `.at() ${js.includes(".at(") ? "emitted verbatim" : "gone"}`;
      }
      return out;
    },
  },
];

export function runAll() {
  assertToolchain();
  mkdirSync(WORK, { recursive: true });
  return experiments.map((e) => ({ ...e, result: e.run() }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`\nhost-mismatch — flip-one-option matrix`);
  console.log(`node ${process.version} · tsc ${execFileSync(TSC, ["--version"], { encoding: "utf8" }).trim()}\n`);
  for (const e of runAll()) {
    console.log(`── ${e.id}   [${e.option}]`);
    console.log(`   ${e.question}\n`);
    for (const [k, v] of Object.entries(e.result)) console.log(`     ${k.padEnd(34)} ${v}`);
    console.log("");
  }
}
