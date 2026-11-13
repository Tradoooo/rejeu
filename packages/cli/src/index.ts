#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  captureCheckpoint,
  findFaulty,
  listSessions,
  loadChain,
  renderReport,
  sessionDigest,
  verifyChain,
} from "@rejeu/core";

const USAGE = `rejeu — rejouer les versions d'un agent, pas ses logs

  rejeu capture  --repo . --session <id> --tool <t> --action <a>
  rejeu ls       --repo .
  rejeu verify   --repo . --session <id>
  rejeu find     --repo . --session <id> --predicate "<commande>" [--mode lineaire|dichotomie|auto]
  rejeu report   --repo . --session <id> --predicate "<commande>" [--out report.html]
  rejeu demo     [--out report.html]
`;

function arg(values: Record<string, string | boolean | undefined>, name: string, fallback?: string): string {
  const value = values[name];
  const text = typeof value === "string" ? value : undefined;
  if (!text) {
    if (fallback !== undefined) return fallback;
    throw new Error(`argument manquant : --${name}`);
  }
  return text;
}

interface Command {
  args: Record<string, string | boolean | undefined>;
  positionals: string[];
}

/** `capture` : enregistre un checkpoint de l'arbre de travail courant. */
function commandCapture(repo: string, values: Command["args"]): number {
  const entry = captureCheckpoint({
    repo,
    session: arg(values, "session"),
    tool: arg(values, "tool", "manual"),
    action: arg(values, "action", "manual"),
  });
  process.stdout.write(`checkpoint #${entry.index} · arbre ${entry.tree.slice(0, 12)} · digest ${entry.digest.slice(0, 12)}\n`);
  return 0;
}

/** `ls` : sessions capturées, ou le message de l'état vide. */
function commandList(repo: string): number {
  const sessions = listSessions(repo);
  if (sessions.length === 0) {
    process.stdout.write("Aucune session. Lancez `rejeu capture` depuis un broker ou la CLI.\n");
    return 0;
  }
  for (const session of sessions) {
    const chain = loadChain(repo, session);
    process.stdout.write(`${session} · ${chain?.entries.length ?? 0} checkpoints\n`);
  }
  return 0;
}

function commandVerify(repo: string, session: string): number {
  const chain = loadChain(repo, session);
  if (!chain) return unknownSession(session);
  const result = verifyChain(chain);
  if (result.ok) {
    process.stdout.write(`CHAÎNE vérifiée ${result.checked}/${result.checked}\n`);
    return 0;
  }
  for (const brk of result.breaks) process.stderr.write(`rupture #${brk.index} (${brk.reason})\n`);
  return 1;
}

function unknownSession(session: string): number {
  process.stderr.write(`session inconnue : ${session}\n`);
  return 2;
}

async function commandFind(repo: string, session: string, values: Command["args"]): Promise<number> {
  const chain = loadChain(repo, session);
  if (!chain) return unknownSession(session);
  const verdict = await findFaulty(repo, chain, {
    predicate: arg(values, "predicate"),
    timeoutMs: Number(arg(values, "timeout", "120000")),
    mode: "auto",
  });
  process.stdout.write(`REJEU · session ${chain.session} · ${chain.entries.length} checkpoints · ${verdict.checkpointsRun} rejoués\n`);
  process.stdout.write(`VERDICT  ${verdict.message}\n`);
  process.stdout.write(`TEMPS    ${(verdict.durationMs / 1000).toFixed(1)} s · hôte ${verdict.hostRepoUnchanged ? "intact" : "MODIFIÉ"}\n`);
  return verdict.status === "localise" ? 0 : 1;
}

async function commandReport(repo: string, session: string, values: Command["args"]): Promise<number> {
  const chain = loadChain(repo, session);
  if (!chain) return unknownSession(session);
  const verdict = await findFaulty(repo, chain, {
    predicate: arg(values, "predicate"),
    timeoutMs: Number(arg(values, "timeout", "120000")),
    mode: "auto",
  });
  const out = resolve(arg(values, "out", join(repo, ".replay", session, "report.html")));
  mkdirSync(join(out, ".."), { recursive: true });
  const html = renderReport({ chain, verdict, verification: verifyChain(chain), generatedAt: new Date().toISOString() });
  writeFileSync(out, html, "utf8");
  writeFileSync(join(out, "..", "session-digest.txt"), `${sessionDigest(chain)}\n`, "utf8");
  process.stdout.write(`rapport ${out}\n`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      repo: { type: "string", default: "." },
      session: { type: "string" },
      tool: { type: "string" },
      action: { type: "string" },
      predicate: { type: "string" },
      mode: { type: "string", default: "lineaire" },
      out: { type: "string" },
      timeout: { type: "string" },
    },
  });
  const command = parsed.positionals[0] ?? "help";
  const repo = resolve(arg(parsed.values, "repo", "."));

  if (command === "help" || command === "--help") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (command === "capture") return commandCapture(repo, parsed.values);
  if (command === "ls") return commandList(repo);
  if (command === "verify") return commandVerify(repo, arg(parsed.values, "session"));
  if (command === "find") return commandFind(repo, arg(parsed.values, "session"), parsed.values);
  if (command === "report") return commandReport(repo, arg(parsed.values, "session"), parsed.values);

  process.stderr.write(`commande inconnue : ${command}\n${USAGE}`);
  return 2;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`rejeu : ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  });
