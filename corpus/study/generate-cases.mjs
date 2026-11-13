/**
 * Génère les cas de l'étude chronométrée.
 *
 * Un cas = un dépôt git réel où :
 *  - l'agent a itéré (états capturés dans une chaîne de checkpoints) ;
 *  - la PR a été **squashée** : un seul commit visible, les itérations
 *    intermédiaires n'existent plus dans l'historique ;
 *  - une seule modification casse le test ; le reste du diff est innocent.
 *
 * Vérité terrain : l'index du checkpoint fautif + le fichier et le jeton fautifs.
 *
 * Usage : node generate-cases.mjs [nombre] [répertoire]
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { captureCheckpoint } from "../../packages/core/src/index.ts";

const COUNT = Number(process.argv[2] ?? 10);
const OUT = resolve(process.argv[3] ?? "/tmp/rejeu-study");

const MODULES = {
  parseur: { good: `export function parse(value) {\n  return value.split(",").map((part) => part.trim());\n}\n`, bad: `export function parse(value) {\n  return value.split(",,").map((part) => part.trim());\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { parse } from "../src/parseur.js";\n\ntest("découpe sur la virgule", () => {\n  assert.deepEqual(parse("a,b,c"), ["a", "b", "c"]);\n});\n` },
  ardoise: { good: `export function ardoise(value) {\n  return value.replace(/\\s+/g, "-").toLowerCase();\n}\n`, bad: `export function ardoise(value) {\n  return value.replace(/\\s+/g, "_").toLowerCase();\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { ardoise } from "../src/ardoise.js";\n\ntest("tirets", () => {\n  assert.equal(ardoise("Deux Mots"), "deux-mots");\n});\n` },
  fenetre: { good: `export function fenetre(size) {\n  return Array.from({ length: size }, (_, index) => index);\n}\n`, bad: `export function fenetre(size) {\n  return Array.from({ length: size + 1 }, (_, index) => index);\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { fenetre } from "../src/fenetre.js";\n\ntest("bornes", () => {\n  assert.deepEqual(fenetre(3), [0, 1, 2]);\n});\n` },
  dossiers: { good: `export function dossiers(liste) {\n  return liste.filter((item) => item.endsWith("/"));\n}\n`, bad: `export function dossiers(liste) {\n  return liste.filter((item) => item.endsWith("\\\\\\\\"));\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { dossiers } from "../src/dossiers.js";\n\ntest("se termine par une barre", () => {\n  assert.deepEqual(dossiers(["a/", "b"]), ["a/"]);\n});\n` },
  journal: { good: `export function journal(items) {\n  return items.join("; ");\n}\n`, bad: `export function journal(items) {\n  return items.join(" ; ");\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { journal } from "../src/journal.js";\n\ntest("séparateur", () => {\n  assert.equal(journal(["a", "b"]), "a; b");\n});\n` },
  bornes: { good: `export function bornes(min, max, value) {\n  return Math.min(Math.max(value, min), max);\n}\n`, bad: `export function bornes(min, max, value) {\n  return Math.max(Math.min(value, min), max);\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { bornes } from "../src/bornes.js";\n\ntest("encadre", () => {\n  assert.equal(bornes(0, 10, 15), 10);\n});\n` },
  somme: { good: `export function somme(values) {\n  return values.reduce((total, value) => total + value, 0);\n}\n`, bad: `export function somme(values) {\n  return values.reduce((total, value) => total + value, 1);\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { somme } from "../src/somme.js";\n\ntest("total", () => {\n  assert.equal(somme([1, 2, 3]), 6);\n});\n` },
  horloge: { good: `export function horloge(minutes) {\n  return \`\${String(Math.floor(minutes / 60)).padStart(2, "0")}:\${String(minutes % 60).padStart(2, "0")}\`;\n}\n`, bad: `export function horloge(minutes) {\n  return \`\${String(Math.floor(minutes / 60)).padStart(2, "0")}:\${String((minutes % 60) + 1).padStart(2, "0")}\`;\n}\n`, test: `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { horloge } from "../src/horloge.js";\n\ntest("minutes", () => {\n  assert.equal(horloge(90), "01:30");\n});\n` },
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

/** Un cas déterministe : mêmes cas à chaque exécution. */
/** Bloc de code « evolved » : la PR de l'agent est une refonte, pas une ligne. */
function evolved(base, name) {
  return `${base}
// refonte : helpers extraits, signatures conservées
export function vide${name.charAt(0).toUpperCase()}${name.slice(1)}() {
  return null;
}

export function egale${name.charAt(0).toUpperCase()}${name.slice(1)}(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function copie${name.charAt(0).toUpperCase()}${name.slice(1)}(value) {
  return JSON.parse(JSON.stringify(value));
}
export function normalise${name.charAt(0).toUpperCase()}${name.slice(1)}(value) {
  return String(value ?? "").trim();
}

export function decoupe${name.charAt(0).toUpperCase()}${name.slice(1)}(value, separateur) {
  return String(value ?? "").split(separateur).filter(Boolean);
}

export function resume${name.charAt(0).toUpperCase()}${name.slice(1)}(items) {
  return items.map((item) => normalise${name.charAt(0).toUpperCase()}${name.slice(1)}(item));
}
`;
}

function plan(index) {
  const names = Object.keys(MODULES);
  const modules = names.map((name, position) => ({ name, position }));
  const faultyModule = modules[index % modules.length].name;
  const iterations = 9 + (index % 4);
  const faultyAt = 1 + ((index * 2) % (iterations - 2));
  return { modules, faultyModule, iterations, faultyAt };
}

function buildCase(index) {
  const { modules, faultyModule, iterations, faultyAt } = plan(index);
  const id = `cas-${String(index).padStart(2, "0")}`;
  const repo = mkdtempSync(join(tmpdir(), `rejeu-case-${id}-`));
  run(repo, ["git", "init", "-q", "-b", "main"]);
  run(repo, ["git", "config", "user.email", "agent@exemple.invalid"]);
  run(repo, ["git", "config", "user.name", "Agent"]);
  write(repo, "package.json", JSON.stringify({ name: id, type: "module", version: "1.0.0" }, null, 2));
  write(repo, "README.md", `# ${id}\n\nProjet de démonstration : l'agent itère, la PR est squashée.\n`);
  for (const module of modules) {
    const definition = MODULES[module.name];
    write(repo, `src/${module.name}.js`, definition.good);
    write(repo, `test/${module.name}.test.js`, definition.test);
  }
  run(repo, ["git", "add", "-A", "--", ".", ":(exclude).replay"]);
  run(repo, ["git", "commit", "-q", "-m", "état initial du projet"]);

  const steps = captureSession(repo, id, modules, faultyModule, faultyAt, iterations);
  squash(repo);

  const faultyStep = steps.find((step) => step.faulty);
  if (!faultyStep) throw new Error(`cas ${id} sans étape fautive`);
  if (steps.filter((step) => step.faulty).length !== 1) throw new Error(`cas ${id} : plusieurs étapes fautives`);

  const truth = {
    id,
    repo: join(OUT, id, "repo"),
    session: id,
    faultyModule,
    faultyFile: faultyStep.file,
    faultyCheckpoint: faultyStep.checkpoint,
    faultyTree: faultyStep.tree,
    iterations,
    faultyAt,
  };
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, "truth.json"), `${JSON.stringify(truth, null, 2)}\n`);
  // Le dépôt est COPIÉ (pas cloné) : un clone ne reprend pas les refs
  // refs/rejeu/*, et les arbres de checkpoints deviendraient introuvables.
  cpSync(repo, join(OUT, id, "repo"), { recursive: true });
  writeFileSync(join(OUT, id, "consigne.md"), consigne(truth));
  return truth;
}

/** Les itérations de l'agent : chaque étape est un checkpoint capturé. */
function captureSession(repo, id, modules, faultyModule, faultyAt, iterations) {
  const innocents = modules.filter((module) => module.name !== faultyModule);
  const steps = [];
  for (let step = 0; step < iterations; step += 1) {
    const faulty = step === faultyAt;
    const name = faulty ? faultyModule : (innocents[step % innocents.length]?.name ?? faultyModule);
    const definition = MODULES[name];
    const file = `src/${name}.js`;
    write(repo, file, evolved(faulty ? definition.bad : definition.good, name));
    const entry = captureCheckpoint({ repo, session: id, tool: "edit", action: `edit:${file}` });
    steps.push({ step, file, faulty, checkpoint: entry.index, tree: entry.tree });
  }
  return steps;
}

/** La PR est squashée : un seul commit, les itérations disparaissent. */
function squash(repo) {
  run(repo, ["git", "add", "-A", "--", ".", ":(exclude).replay"]);
  run(repo, ["git", "commit", "-q", "-m", "PR squashée : refonte des modules"]);
}

function consigne(truth) {
  return `# Cas ${truth.id}

Dépôt : \`${truth.repo}\`

La suite de tests échoue. **Identifie la modification qui a cassé le test** :
le fichier fautif et l'expression fautive (la ligne exacte).

Règles :
- travaille uniquement dans ce dépôt, ne modifie rien ;
- si tu disposes d'un outil de rejeu, tu peux t'en servir ;
- réponds au format exact :

FILE: src/xxx.js
TOKEN: l'expression fautive (quelques caractères)
ITERATION: <l'index d'itération si tu le sais, sinon "inconnue">

puis une phrase d'explication. Pas de Markup, pas de code qui traîne.
`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const truths = [];
for (let index = 0; index < COUNT; index += 1) truths.push(buildCase(index));
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(truths.map((truth) => ({ id: truth.id, repo: truth.repo, faultyFile: truth.faultyFile, faultyCheckpoint: truth.faultyCheckpoint, token: truth.token })), null, 2)}\n`);
process.stdout.write(`${truths.length} cas générés dans ${OUT}\n`);
for (const truth of truths) process.stdout.write(`  ${truth.id} : faute dans ${truth.faultyFile} (checkpoint #${truth.faultyCheckpoint})\n`);
