/**
 * Capture le « reel » de la démonstration : toutes les sorties affichées dans
 * la vidéo sont produites ICI, par de vraies exécutions.
 *
 * Source : une session réelle d'agent (opencode + broker) rejouée depuis son
 * dépôt — on extrait l'état fautif, on exécute le prédicat, on lance le hook,
 * on rejoue la recherche du checkpoint fautif. Rien n'est écrit à la main.
 *
 * Sortie : fixtures/reel.json
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { extractTree } from "../packages/core/src/index.ts";

const SOURCE = process.env.REJEU_REEL_SOURCE ?? "/tmp/rejeu-real";
const SESSION = process.env.REJEU_REEL_SESSION ?? "opencode-02";
const PREDICATE = "node --test test/parser.test.js";
const CLI = resolve("packages/cli/src/index.ts");
const HOOK = resolve(".kiro/hooks/checkpoint-guard.sh");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Mesures du banc (corpus/out/mesure.json) : les chiffres affichés sont les miens. */
function readMeasures() {
  try {
    const summary = JSON.parse(readFileSync(resolve("corpus", "out", "mesure.json"), "utf8"));
    return {
      sessions: summary.sessions,
      correct: summary.correct,
      accuracy: summary.accuracy,
      medianSeconds: summary.medianSeconds,
      minSeconds: summary.minSeconds,
      maxSeconds: summary.maxSeconds,
      replayed: summary.replayed,
      checkpoints: summary.checkpoints,
    };
  } catch {
    return null;
  }
}

/** Début + fin d'une sortie longue : l'essentiel sans noyer l'image. */
function excerpt(text, head, tail) {
  const lines = text.split("\n");
  if (lines.length <= head + tail + 1) return text;
  return [...lines.slice(0, head), "   ⋮   ", ...lines.slice(-tail)].join("\n");
}

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  return { code: result.status ?? -1, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

const work = mkdtempSync(join(tmpdir(), "rejeu-reel-"));
try {
  cpSync(SOURCE, work, { recursive: true });
  const chain = JSON.parse(readFileSync(join(work, ".replay", SESSION, "chain.json"), "utf8"));
  const base = run(work, ["git", "rev-parse", "HEAD"]).stdout;
  const faultyTree = chain.entries[0].tree;

  // 1. L'état fautif, extrait comme rejeu le fait, et son test réel.
  const broken = join(work, ".reel-broken");
  extractTree(work, faultyTree, broken);
  const redTest = run(broken, ["node", "--test", "test/parser.test.js"]);
  // Le diff porte sur les fichiers du projet : le journal `.replay/` n'est pas
  // du code et n'a rien à faire dans l'image.
  const diff = run(work, ["git", "diff", base, faultyTree, "--", "src", "test", "package.json"]);
  const commitList = run(work, ["git", "log", "--oneline", "-3"]).stdout;

  // 2. La chaîne, vérifiée pour de vrai.
  const verify = run(work, ["node", CLI, "verify", "--repo", work, "--session", SESSION]);

  // 3. La recherche du checkpoint fautif, réellement exécutée.
  const find = run(work, ["node", CLI, "find", "--repo", work, "--session", SESSION, "--predicate", PREDICATE]);

  // 4. Le hook qui refuse l'amend.
  const hook = run(work, ["bash", "-c", `printf '%s' '{"command":"git commit --amend --no-edit"}' | ${HOOK}`]);

  // 5. Le rapport imprimable produit par le même rejeu.
  const report = run(work, ["node", CLI, "report", "--repo", work, "--session", SESSION, "--predicate", PREDICATE]);

  const reel = {
    session: SESSION,
    capturedAt: new Date().toISOString(),
    predicate: PREDICATE,
    problem: {
      commitList,
      diff: diff.stdout,
      redTest: excerpt(redTest.stdout, 4, 9),
      redTestFailed: redTest.code !== 0,
    },
    capture: {
      verify: verify.stdout,
      chain: JSON.stringify(
        chain.entries.map((entry) => ({ index: entry.index, tool: entry.tool, action: entry.action, tree: entry.tree.slice(0, 10) })),
        null,
        2,
      ),
    },
    find: { stdout: find.stdout, stderr: find.stderr },
    hook: { stdout: hook.stdout, stderr: hook.stderr, code: hook.code },
    report: { path: report.stdout },
    measures: readMeasures(),
    proxyCalls: readJson(resolve("fixtures", "session-proxy", "calls.json")),
    proxyChain: readJson(resolve("fixtures", "session-proxy", "chain.json")),
  };
  mkdirSync(resolve("fixtures"), { recursive: true });
  writeFileSync(resolve("fixtures", "reel.json"), `${JSON.stringify(reel, null, 2)}\n`);
  process.stdout.write(`reel capturé : ${reel.capture.verify || reel.find.stdout.split("\n")[0]}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
