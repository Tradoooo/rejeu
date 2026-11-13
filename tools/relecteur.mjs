#!/usr/bin/env node
/**
 * Lecteur — auditeur en LECTURE SEULE.
 *
 * Il vérifie la conformité d'une chaîne d'attestation et de la correspondance
 * entre les exigences EARS et leurs vérificateurs. Il n'écrit jamais : le
 * dépôt est ouvert en lecture, et toute tentative d'écriture est refusée.
 *
 * Usage : node tools/relecteur.mjs --repo <dépôt> --session <id> [--spec <fichier>]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { verifyChain } from "../packages/core/src/index.ts";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const repo = resolve(value("repo") ?? ".");
const session = value("session") ?? "";
const specPath = value("spec") ?? resolve(".kiro/specs/replay/requirements.md");
const problems = [];

if (!session) problems.push("argument manquant : --session");
const chainPath = resolve(repo, ".replay", session, "chain.json");
if (!existsSync(chainPath)) {
  problems.push(`chaîne absente : ${chainPath}`);
} else {
  const chain = JSON.parse(readFileSync(chainPath, "utf8"));
  const result = verifyChain(chain);
  if (!result.ok) for (const brk of result.breaks) problems.push(`chaîne rompue au #${brk.index} (${brk.reason})`);
  for (const entry of chain.entries) {
    if (!entry.action || !entry.tool) problems.push(`entrée #${entry.index} incomplète`);
    if (!/^[0-9a-f]{40,64}$/.test(entry.tree)) problems.push(`entrée #${entry.index} : arbre invalide`);
  }
}

if (existsSync(specPath)) {
  const spec = readFileSync(specPath, "utf8");
  const ids = [...spec.matchAll(/\|\s*(REJ-[A-Z]-\d{2})\s*\|/g)].map((match) => match[1]);
  const withoutVerifier = ids.filter((id) => {
    const line = spec.split("\n").find((candidate) => candidate.includes(`| ${id} |`)) ?? "";
    return !line.includes("`") || !line.includes(".ts") && !line.includes(".sh") && !line.includes(".mjs");
  });
  for (const id of withoutVerifier) problems.push(`exigence ${id} sans vérificateur nommé`);
  if (ids.length === 0) problems.push(`aucune exigence trouvée dans ${specPath}`);
}

process.stdout.write(problems.length === 0
  ? `relecteur : conforme (session ${session}, ${existsSync(chainPath) ? "chaîne vérifiée" : "sans chaîne"})\n`
  : `relecteur : ${problems.length} problème(s)\n${problems.map((problem) => `  ✕ ${problem}`).join("\n")}\n`);
process.exit(problems.length === 0 ? 0 : 1);
