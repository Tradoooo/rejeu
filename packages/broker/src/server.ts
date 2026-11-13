#!/usr/bin/env node
/**
 * Broker MCP de Rejeu — zéro dépendance, JSON-RPC 2.0 délimité par newline.
 *
 * Il s'interpose entre un agent (CLI headless) et ses outils : chaque appel
 * mutant passe par `tools/call` et laisse un checkpoint. Aucun code de
 * l'agent n'est modifié ; l'agent n'est pas tracé.
 */
import { createInterface } from "node:readline";
import { captureCheckpoint, findFaulty, loadChain, verifyChain } from "@rejeu/core";

const REPO = process.env.REJEU_REPO ?? process.cwd();
const SESSION = process.env.REJEU_SESSION ?? "default";

const TOOLS = [
  {
    name: "replay_checkpoint",
    description: "Enregistre un checkpoint (état du dépôt) après un appel d'outil mutant.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string" },
        action: { type: "string" },
        outside: { type: "object" },
      },
      required: ["tool", "action"],
    },
  },
  {
    name: "first_faulty",
    description: "Rejoue les checkpoints et renvoie l'index du premier où le prédicat bascule.",
    inputSchema: {
      type: "object",
      properties: { predicate: { type: "string" }, mode: { type: "string" } },
      required: ["predicate"],
    },
  },
  {
    name: "verify_chain",
    description: "Vérifie l'intégrité de la chaîne d'attestation de la session.",
    inputSchema: { type: "object", properties: { session: { type: "string" } } },
  },
];

type Params = Record<string, unknown>;

async function callTool(name: string, args: Params): Promise<unknown> {
  if (name === "replay_checkpoint") {
    const entry = captureCheckpoint({
      repo: REPO,
      session: SESSION,
      tool: String(args.tool ?? "unknown"),
      action: String(args.action ?? "unknown"),
      outside: (args.outside as Record<string, string> | undefined) ?? {},
    });
    return { index: entry.index, tree: entry.tree, digest: entry.digest };
  }
  if (name === "first_faulty") {
    const chain = loadChain(REPO, SESSION);
    if (!chain) throw new Error(`session inconnue : ${SESSION}`);
    const verdict = await findFaulty(REPO, chain, {
      predicate: String(args.predicate),
      mode: (args.mode as "lineaire" | "dichotomie" | "auto" | undefined) ?? "auto",
    });
    return verdict;
  }
  if (name === "verify_chain") {
    const session = String(args.session ?? SESSION);
    const chain = loadChain(REPO, session);
    if (!chain) throw new Error(`session inconnue : ${session}`);
    return verifyChain(chain);
  }
  throw new Error(`outil inconnu : ${name}`);
}

function reply(id: unknown, payload: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, ...(payload as object) })}\n`);
}

async function handle(message: Params): Promise<void> {
  const id = message.id;
  const method = String(message.method ?? "");
  const params = (message.params as Params | undefined) ?? {};
  if (method === "initialize") {
    reply(id, {
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "rejeu-broker", version: "0.1.0" },
        capabilities: { tools: {} },
      },
    });
    return;
  }
  if (method === "notifications/initialized" || method.startsWith("notifications/")) return;
  if (method === "ping") {
    reply(id, { result: {} });
    return;
  }
  if (method === "tools/list") {
    reply(id, { result: { tools: TOOLS } });
    return;
  }
  if (method === "tools/call") {
    try {
      const value = await callTool(String(params.name ?? ""), (params.arguments as Params | undefined) ?? {});
      reply(id, { result: { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], isError: false } });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      reply(id, { result: { content: [{ type: "text", text }], isError: true } });
    }
    return;
  }
  reply(id, { error: { code: -32601, message: `méthode inconnue : ${method}` } });
}

const reader = createInterface({ input: process.stdin });
reader.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message: Params;
  try {
    message = JSON.parse(trimmed) as Params;
  } catch {
    process.stderr.write("rejeu-broker : JSON invalide\n");
    return;
  }
  void handle(message);
});
