/**
 * Fabrique la démonstration HORS LIGNE à partir d'une exécution RÉELLE.
 *
 * On construit un dépôt git réel dans un répertoire temporaire, on capture
 * sept checkpoints réels (arbres git), puis on exécute réellement le prédicat
 * à chaque checkpoint. Le résultat enregistré (chaîne, verdict, diff, temps)
 * est ce que la page de démonstration rejoue sans réseau : elle ne peut pas
 * échouer devant un jury, et elle ne prétend rien mesurer à l'écran.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { captureCheckpoint, findFaulty, loadChain, sessionDigest, verifyChain } from "../packages/core/src/index.ts";

const OUT = resolve("fixtures/demo");
const SESSION = "a41f9c2";
const PREDICATE = "node --test test/parser.test.js";

const GOOD = `export function parse(value) {\n  return value.split(",").map((part) => part.trim());\n}\n`;
const BAD = `export function parse(value) {\n  return value.split(",,").map((part) => part.trim());\n}\n`;
const TEST = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { parse } from "../src/parser.js";\n\ntest("découpe sur la virgule", () => {\n  assert.deepEqual(parse("a,b,c"), ["a", "b", "c"]);\n});\n`;
const ACTIONS = [
  "edit:src/parser.js · introduction du parseur",
  "edit:test/parser.test.js · écriture du test",
  "edit:src/parser.js · correction du séparateur (bug introduit)",
  "bash:node --test · suite rouge, l'agent itère",
  "edit:src/parser.js · rétablissement du séparateur",
  "bash:node --test · suite verte",
  "commit:squash de la PR",
];

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} : ${result.stderr}`);
  return (result.stdout ?? "").trim();
}

function write(cwd, path, content) {
  mkdirSync(join(cwd, path, ".."), { recursive: true });
  writeFileSync(join(cwd, path), content, "utf8");
}

const repo = mkdtempSync(join(tmpdir(), "rejeu-demo-"));
try {
  run(repo, ["git", "init", "-q", "-b", "main"]);
  run(repo, ["git", "config", "user.email", "demo@rejeu.invalid"]);
  run(repo, ["git", "config", "user.name", "Rejeu demo"]);
  write(repo, "package.json", JSON.stringify({ name: "parser-demo", type: "module", version: "1.0.0" }, null, 2));
  write(repo, "README.md", "# parser-demo\n\nDépôt miniature embarqué par Rejeu pour la démonstration hors ligne.\n");
  write(repo, "src/parser.js", GOOD);
  write(repo, "test/parser.test.js", TEST);
  run(repo, ["git", "add", "-A"]);
  run(repo, ["git", "commit", "-q", "-m", "état initial"]);

  const parsers = [GOOD, GOOD, BAD, BAD, GOOD, GOOD, GOOD];
  parsers.forEach((parser, index) => {
    write(repo, "src/parser.js", `${parser}\n// itération ${index + 1}\n`);
    captureCheckpoint({ repo, session: SESSION, tool: ACTIONS[index].split(":")[0], action: ACTIONS[index] });
  });

  const chain = loadChain(repo, SESSION);
  if (!chain) throw new Error("chaîne non capturée");
  const verdict = await findFaulty(repo, chain, { predicate: PREDICATE, mode: "lineaire" });
  const verification = verifyChain(chain);
  const faulty = verdict.faultyIndex;
  const predecessor = faulty === null ? null : faulty - 1;
  const diff =
    faulty === null || predecessor === null || predecessor < 0
      ? ""
      : run(repo, ["git", "diff", chain.entries[predecessor].tree, chain.entries[faulty].tree]);

  // Second artefact RÉEL : un prédicat non déterministe (verdict suspendu).
  const counter = join(repo, ".flaky-counter");
  writeFileSync(counter, "1");
  const flakyTest = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFileSync, writeFileSync } from "node:fs";\nconst COUNTER = ${JSON.stringify(counter)};\ntest("instable", () => {\n  const seen = Number(readFileSync(COUNTER, "utf8"));\n  writeFileSync(COUNTER, String(seen + 1));\n  assert.equal(seen % 2, 0);\n});\n`;
  write(repo, "test/flaky.test.js", flakyTest);
  run(repo, ["git", "add", "-A"]);
  run(repo, ["git", "commit", "-q", "-m", "test instable"]);
  captureCheckpoint({ repo, session: "flaky", tool: "write", action: "write:test/flaky.test.js · test instable" });
  const flakyChain = loadChain(repo, "flaky");
  if (!flakyChain) throw new Error("chaîne flaky non capturée");
  const flakyVerdict = await findFaulty(repo, flakyChain, { predicate: "node --test test/flaky.test.js", mode: "lineaire" });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "flaky.json"),
    `${JSON.stringify({ chain: flakyChain, verdict: flakyVerdict, verification: verifyChain(flakyChain), sessionDigest: sessionDigest(flakyChain), predicate: "node --test test/flaky.test.js" }, null, 2)}\n`,
  );
  writeFileSync(join(OUT, "chain.json"), `${JSON.stringify(chain, null, 2)}\n`);
  writeFileSync(
    join(OUT, "verdict.json"),
    `${JSON.stringify({ ...verdict, verification, sessionDigest: sessionDigest(chain), predicate: PREDICATE, diff }, null, 2)}\n`,
  );
  process.stdout.write(
    `démo enregistrée · ${chain.entries.length} checkpoints · verdict ${verdict.status} #${verdict.faultyIndex} · ${(verdict.durationMs / 1000).toFixed(1)} s · ${verdict.checkpointsRun} rejoués\n`,
  );
} finally {
  rmSync(repo, { recursive: true, force: true });
}
