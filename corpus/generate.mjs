/**
 * Banc de mesure de Rejeu — 20 sessions.
 *
 * Chaque session est un dépôt git RÉEL (arbres réels, commits réels), une
 * suite de tests réelle exécutée par `node --test`, et un défaut réellement
 * introduit à un index connu (la vérité terrain). Ce qui est scripté, c'est
 * l'injection du défaut, pas la mesure : chaque verdict est produit par une
 * exécution réelle du prédicat sur chaque arbre.
 *
 * Sortie : corpus/out/session-XX/{chain.json,truth.json}
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { captureCheckpoint, loadChain } from "../packages/core/src/index.ts";

const OUT = resolve("corpus/out");
const MODULES = {
  parser: {
    good: `export function parse(value) {\n  return value.split(",").map((part) => part.trim());\n}\n`,
    bad: `export function parse(value) {\n  return value.split(",,").map((part) => part.trim());\n}\n`,
    test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { parse } from "../src/parser.js";\n\ntest("découpe sur la virgule", () => {\n  assert.deepEqual(parse("a,b,c"), ["a", "b", "c"]);\n});\n`,
  },
  slug: {
    good: `export function slug(value) {\n  return value.toLowerCase().replace(/\\s+/g, "-");\n}\n`,
    bad: `export function slug(value) {\n  return value.toLowerCase().replace(/\\s+/g, "_");\n}\n`,
    test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { slug } from "../src/slug.js";\n\ntest("tirets", () => {\n  assert.equal(slug("Deux Mots"), "deux-mots");\n});\n`,
  },
  range: {
    good: `export function range(size) {\n  return Array.from({ length: size }, (_, index) => index);\n}\n`,
    bad: `export function range(size) {\n  return Array.from({ length: size + 1 }, (_, index) => index);\n}\n`,
    test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { range } from "../src/range.js";\n\ntest("bornes", () => {\n  assert.deepEqual(range(3), [0, 1, 2]);\n});\n`,
  },
};

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} : ${result.stderr}`);
  return (result.stdout ?? "").trim();
}

function write(cwd, path, content) {
  mkdirSync(join(cwd, path, ".."), { recursive: true });
  writeFileSync(join(cwd, path), content, "utf8");
}

/** Déterministe : même banc à chaque exécution (aucun aléatoire implicite). */
function plan(sessionIndex) {
  const name = Object.keys(MODULES)[sessionIndex % 3];
  const size = 5 + (sessionIndex % 8);
  const faulty = 1 + ((sessionIndex * 3) % (size - 2));
  const fixed = faulty + 1 + (sessionIndex % 2) < size ? faulty + 1 + (sessionIndex % 2) : null;
  return { name, size, faulty, fixed };
}

function buildSession(sessionIndex) {
  const { name, size, faulty, fixed } = plan(sessionIndex);
  const module = MODULES[name];
  const session = `bench-${String(sessionIndex).padStart(2, "0")}`;
  const repo = mkdtempSync(join(tmpdir(), `rejeu-bench-${sessionIndex}-`));
  try {
    run(repo, ["git", "init", "-q", "-b", "main"]);
    run(repo, ["git", "config", "user.email", "bench@rejeu.invalid"]);
    run(repo, ["git", "config", "user.name", "Rejeu bench"]);
    write(repo, "package.json", JSON.stringify({ name: `bench-${name}`, type: "module" }, null, 2));
    write(repo, `src/${name}.js`, module.good);
    write(repo, `test/${name}.test.js`, module.test);
    run(repo, ["git", "add", "-A"]);
    run(repo, ["git", "commit", "-q", "-m", "état initial"]);

    for (let index = 0; index < size; index += 1) {
      const broken = index >= faulty && (fixed === null || index < fixed);
      write(repo, `src/${name}.js`, `${broken ? module.bad : module.good}\n// itération ${index + 1}\n`);
      captureCheckpoint({ repo, session, tool: "edit", action: `edit:src/${name}.js#${index + 1}` });
    }

    const chain = loadChain(repo, session);
    if (!chain) throw new Error("chaîne absente");
    const directory = join(OUT, session);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "chain.json"), `${JSON.stringify(chain, null, 2)}\n`);
    // Le dépôt git complet (blobs + arbres) est conservé par session : les
    // verdicts doivent pouvoir être rejoués plus tard, hors du temporaire.
    cpSync(join(repo, ".git"), join(directory, "git"), { recursive: true });
    writeFileSync(
      join(directory, "truth.json"),
      `${JSON.stringify({ session, module: name, size, faultyIndex: faulty, fixedIndex: fixed, predicate: `node --test test/${name}.test.js` }, null, 2)}\n`,
    );
    return session;
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sessions = Array.from({ length: 20 }, (_, index) => buildSession(index));
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(sessions, null, 2)}\n`);
process.stdout.write(`${sessions.length} sessions générées dans ${OUT}\n`);
