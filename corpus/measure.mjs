/**
 * Mesure le banc : pour chaque session, exécute réellement le prédicat sur
 * chaque checkpoint et compare l'index trouvé à la vérité terrain.
 * Produit docs/MESURES.md et mesure.json — les deux chiffres publiés.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { findFaulty, verifyChain } from "../packages/core/src/index.ts";

const OUT = resolve("corpus/out");
const sessions = JSON.parse(readFileSync(join(OUT, "index.json"), "utf8"));
const rows = [];

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} : ${result.stderr}`);
  return (result.stdout ?? "").trim();
}

for (const session of sessions) {
  const chain = JSON.parse(readFileSync(join(OUT, session, "chain.json"), "utf8"));
  const truth = JSON.parse(readFileSync(join(OUT, session, "truth.json"), "utf8"));
  // Dépôt jetable : les arbres du corpus y sont réimportés (objets git réels).
  const repo = mkdtempSync(join(tmpdir(), "rejeu-measure-"));
  try {
    // Les arbres viennent du dépôt git conservé avec la session.
    cpSync(join(OUT, session, "git"), join(repo, ".git"), { recursive: true });
    const verdict = await findFaulty(repo, chain, { predicate: truth.predicate, mode: "lineaire" });
    rows.push({
      session,
      module: truth.module,
      checkpoints: truth.size,
      truth: truth.faultyIndex,
      found: verdict.faultyIndex,
      status: verdict.status,
      correct: verdict.faultyIndex === truth.faultyIndex,
      seconds: Number((verdict.durationMs / 1000).toFixed(2)),
      replayed: verdict.checkpointsRun,
      chainOk: verifyChain(chain).ok,
      hostUnchanged: verdict.hostRepoUnchanged,
    });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const correct = rows.filter((row) => row.correct).length;
const seconds = rows.map((row) => row.seconds).sort((a, b) => a - b);
const median = seconds[Math.floor(seconds.length / 2)] ?? 0;
const checkpoints = rows.reduce((sum, row) => sum + row.checkpoints, 0);
const replayed = rows.reduce((sum, row) => sum + row.replayed, 0);
const summary = {
  sessions: rows.length,
  correct,
  accuracy: Number(((correct / rows.length) * 100).toFixed(1)),
  medianSeconds: median,
  minSeconds: seconds[0] ?? 0,
  maxSeconds: seconds.at(-1) ?? 0,
  checkpoints,
  replayed,
  chainsVerified: rows.filter((row) => row.chainOk).length,
  hostsUnchanged: rows.filter((row) => row.hostUnchanged).length,
  measuredAt: new Date().toISOString(),
  rows,
};

mkdirSync(resolve("docs"), { recursive: true });
writeFileSync(join(OUT, "mesure.json"), `${JSON.stringify(summary, null, 2)}\n`);

const table = rows
  .map((row) => `| ${row.session} | ${row.module} | ${row.checkpoints} | #${row.truth} | #${row.found} | ${row.correct ? "oui" : "NON"} | ${row.seconds.toFixed(2)} s | ${row.replayed} | ${row.chainOk ? "vérifiée" : "ROMPUE"} |`)
  .join("\n");

writeFileSync(
  resolve("docs/MESURES.md"),
  `# Mesures — banc de 20 sessions (exécution réelle)

Mesuré le ${summary.measuredAt} par \`node corpus/generate.mjs && node corpus/measure.mjs\`.
Chaque verdict provient de l'exécution réelle du prédicat sur chaque arbre
git du corpus. Ce qui est scripté : l'injection du défaut et sa position.

| Chiffre | Valeur |
|---|---|
| Sessions | ${summary.sessions} |
| Localisations correctes | **${summary.correct}/${summary.sessions}** (${summary.accuracy} %) |
| Temps médian par session | **${summary.medianSeconds.toFixed(2)} s** (min ${summary.minSeconds.toFixed(2)}, max ${summary.maxSeconds.toFixed(2)}) |
| Checkpoints rejoués | ${summary.replayed}/${summary.checkpoints} |
| Chaînes vérifiées | ${summary.chainsVerified}/${summary.sessions} |
| Dépôts hôtes intacts | ${summary.hostsUnchanged}/${summary.sessions} |

| Session | Module | Checkpoints | Vérité | Trouvé | Correct | Temps | Rejoués | Chaîne |
|---|---|---|---|---|---|---|---|---|
${table}

## Ce qui n'est pas mesuré

- Une session réelle d'agent (CLI headless) : le contrat du broker est écrit
  et le serveur existe, la capture d'une session d'agent réelle reste à faire.
- La comparaison avec la recherche manuelle : elle exige des chronométrages
  humains, non réalisés.
`,
);
process.stdout.write(`mesure : ${correct}/${rows.length} correctes · médiane ${summary.medianSeconds.toFixed(2)} s · ${replayed}/${checkpoints} checkpoints rejoués\n`);
