/**
 * Mesure l'effet du steering `determinism.md` sur un exemple précis.
 *
 * AVANT : un fichier versionné embarque l'horloge murale → chaque capture de
 * la même action donne un arbre différent (faux écarts sur la timeline).
 * APRÈS : la règle d'exclusion (`.replayignore`) retire ce fichier de l'état
 * capturé → les captures sont identiques.
 *
 * Sortie : docs/preuves/steering.json
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { captureCheckpoint } from "../packages/core/src/index.ts";

const CAPTURES = 7;

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} : ${result.stderr}`);
}

function build(withRule) {
  const repo = mkdtempSync(join(tmpdir(), "rejeu-steering-"));
  run(repo, ["git", "init", "-q", "-b", "main"]);
  run(repo, ["git", "config", "user.email", "s@r.invalid"]);
  run(repo, ["git", "config", "user.name", "r"]);
  writeFileSync(join(repo, "package.json"), '{"type":"module"}\n');
  writeFileSync(join(repo, "scripts-version.mjs"), 'import { writeFileSync } from "node:fs";\nwriteFileSync("VERSION", String(Date.now()));\n');
  if (withRule) writeFileSync(join(repo, ".replayignore"), "VERSION\n");
  run(repo, ["git", "add", "-A"]);
  run(repo, ["git", "commit", "-q", "-m", "init"]);
  const trees = new Set();
  for (let index = 0; index < CAPTURES; index += 1) {
    run(repo, ["node", "scripts-version.mjs"]);
    trees.add(captureCheckpoint({ repo, session: "steer", tool: "bash", action: "node scripts-version.mjs" }).tree);
  }
  rmSync(repo, { recursive: true, force: true });
  return trees.size;
}

const before = build(false);
const after = build(true);
const report = {
  measuredAt: new Date().toISOString(),
  captures: CAPTURES,
  before: { distinctTrees: before, falseDiffs: before - 1 },
  after: { distinctTrees: after, falseDiffs: after - 1 },
  steering: ".kiro/steering/determinism.md",
};
mkdirSync(resolve("docs/preuves"), { recursive: true });
writeFileSync(resolve("docs/preuves/steering.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
