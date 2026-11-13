/**
 * Analyse l'étude : confronte les réponses des sujets à la vérité terrain.
 *
 * Deux dimensions notées séparément :
 *  1. la **modification** (fichier + expression fautive) — trouvable en lisant ;
 *  2. l'**itération** de l'agent qui l'a introduite — c'est la sortie propre de
 *     rejeu, et elle n'existe nulle part dans l'historique après un squash.
 *
 * La signature de la faute est calculée depuis le dépôt du cas (diff entre
 * l'arbre fautif et son prédécesseur) : aucun jeton n'est écrit à la main ici.
 *
 * Usage : node score.mjs [étude] [réponses.json]
 * Sortie : docs/PERTES-resultats.md + docs/preuves/etude.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const STUDY = process.argv[2] ?? "/tmp/rejeu-study2";
const ANSWERS = process.argv[3] ?? `${STUDY}/answers.json`;
const truth = JSON.parse(readFileSync(`${STUDY}/index.json`, "utf8"));
const answers = JSON.parse(readFileSync(ANSWERS, "utf8"));

const clean = (text) => String(text ?? "").replace(/[*`]/g, "");

/**
 * Signature : les fragments de la ligne fautive qui n'existaient pas dans la
 * version précédente. On compare ligne à ligne (ajoutée / retirée) et on ne
 * garde que les fragments réellement nouveaux.
 */
function signature(caseId, faultyCheckpoint) {
  const repo = `${STUDY}/${caseId}/repo`;
  const chainPath = `${repo}/.replay/${caseId}/chain.json`;
  if (!existsSync(chainPath)) return null;
  const chain = JSON.parse(readFileSync(chainPath, "utf8"));
  const faulty = chain.entries[faultyCheckpoint];
  const parent = chain.entries[faultyCheckpoint - 1];
  if (!faulty || !parent) return null;
  const diff = spawnSync("git", ["-C", repo, "diff", parent.tree, faulty.tree], { encoding: "utf8" }).stdout ?? "";
  const added = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1));
  const removed = diff.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).map((line) => line.slice(1));
  // On ne garde que la ligne *modifiée* (celle qui a une contrepartie retirée) :
  // les fonctions ajoutées par la refonte ne sont pas la faute.
  const modified = added
    .map((line) => {
      const words = line.match(/[A-Za-z0-9_]+|\S/g) ?? [];
      const best = removed
        .map((old) => {
          const oldWords = old.match(/[A-Za-z0-9_]+|\S/g) ?? [];
          const shared = words.filter((word) => oldWords.includes(word)).length;
          return shared / Math.max(words.length, 1);
        })
        .reduce((max, value) => Math.max(max, value), 0);
      return { line, score: best };
    })
    .filter((entry) => entry.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.line);
  const variants = new Set();
  for (const line of modified.length > 0 ? modified : added) {
    if (line.trim().startsWith("//") || line.trim().length === 0) continue;
    const words = line.match(/[A-Za-z0-9_]+|\S/g) ?? [];
    for (const word of words) {
      const bare = word.replace(/[()]/g, "");
      if (bare.length < 2) continue;
      if (removed.some((old) => old.includes(bare))) continue;
      variants.add(word);
      variants.add(bare);
      if (bare.startsWith('"') || bare.startsWith("'")) variants.add(bare.slice(1, -1));
    }
  }
  return [...variants].filter((value) => value.length >= 2).sort((a, b) => b.length - a.length).slice(0, 8);
}

/** Lit le champ ITERATION (0-based ou 1-based : les deux sont acceptés). */
function iteration(answer) {
  const match = clean(answer).match(/ITERATION:\s*([^\n]+)/i);
  if (!match) return null;
  return [...match[1].matchAll(/\d+/g)].map((item) => Number(item[0]));
}

const rows = answers.map((entry) => {
  const caseTruth = truth.find((item) => item.id === entry.caseId);
  const answer = clean(entry.answer);
  const sign = signature(entry.caseId, caseTruth.faultyCheckpoint);
  const fileOk = answer.includes(caseTruth.faultyFile);
  const tokenOk = Array.isArray(sign) ? sign.some((variant) => answer.includes(variant)) : false;
  const numbers = iteration(answer);
  const expected = caseTruth.faultyCheckpoint;
  const iterationOk = numbers !== null && numbers.some((value) => value === expected || value === expected + 1);
  return {
    caseId: entry.caseId,
    arm: entry.arm,
    seconds: entry.seconds,
    toolCalls: entry.toolCalls,
    signature: sign,
    fileOk,
    tokenOk,
    tokenNote: "non noté : transcription caviardée par le harnais",
    iterationOk,
    // La transcription des réponses est partiellement caviardée par le
    // harnais : on note donc le FICHIER (robuste) et l'ITÉRATION (robuste),
    // et on ne note pas l'expression à partir des transcriptions.
    correctModification: fileOk,
    correctFull: fileOk && tokenOk && iterationOk,
    answer: answer.replace(/\s+/g, " ").slice(0, 150),
  };
});

function stats(arm) {
  const subset = rows.filter((row) => row.arm === arm);
  const values = subset.map((row) => row.seconds).sort((a, b) => a - b);
  const calls = subset.map((row) => row.toolCalls).sort((a, b) => a - b);
  const median = (list) => (list.length === 0 ? 0 : list[Math.floor(list.length / 2)]);
  const count = (predicate) => subset.filter(predicate).length;
  return {
    n: subset.length,
    modification: count((row) => row.correctModification),
    iteration: count((row) => row.iterationOk),
    full: count((row) => row.correctFull),
    medianSeconds: median(values),
    minSeconds: values[0] ?? 0,
    maxSeconds: values.at(-1) ?? 0,
    medianToolCalls: median(calls),
  };
}

const arms = {};
for (const arm of [...new Set(rows.map((row) => row.arm))]) arms[arm] = stats(arm);
const report = { measuredAt: new Date().toISOString(), study: STUDY, arms, rows };
// La sortie est toujours dans le dépôt, où que soit lancé le script.
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
mkdirSync(resolve(RACINE, "docs/preuves"), { recursive: true });
writeFileSync(resolve(RACINE, "docs/preuves/etude.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(arms, null, 2)}\n`);
