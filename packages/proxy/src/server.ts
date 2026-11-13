#!/usr/bin/env node
/**
 * Proxy MCP non coopératif — capture sans que l'agent le demande.
 *
 * Le proxy se place ENTRE l'agent et un serveur MCP (le « serveur enveloppé »)
 * et lui parle le même protocole. Chaque `tools/call` est transmis tel quel,
 * puis l'état du dépôt est capturé **si et seulement s'il a changé** : la
 * capture ne dépend d'aucune bonne volonté de l'agent.
 *
 * Variables d'environnement :
 *   REJEU_PROXY_COMMAND  commande du serveur enveloppé (ex. "node srv.mjs")
 *   REJEU_REPO           dépôt à capturer
 *   REJEU_SESSION        nom de la session
 *   REJEU_HOOK           hook à faire passer avant chaque appel (optionnel)
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { captureCheckpointIfChanged, verifyChain } from "@rejeu/core";

const COMMAND = process.env.REJEU_PROXY_COMMAND ?? "";
const HOOK = process.env.REJEU_HOOK ?? "";
const REPO = process.env.REJEU_REPO ?? process.cwd();
const SESSION = process.env.REJEU_SESSION ?? "proxy";

/** File d'attente des réponses du serveur enveloppé, par identifiant. */
const pending = new Map<number | string, (value: unknown) => void>();
type Wrapped = ChildProcessByStdio<Writable, Readable, null>;

let child: Wrapped | null = null;

function startWrapped(): Wrapped {
  const parts = COMMAND.split(" ").filter(Boolean);
  if (parts.length === 0) throw new Error("REJEU_PROXY_COMMAND vide");
  const process_ = spawn(parts[0] as string, parts.slice(1), { stdio: ["pipe", "pipe", "inherit"] }) as Wrapped;
  createInterface({ input: process_.stdout }).on("line", (line) => {
    let message: { id?: number | string; result?: unknown; error?: unknown };
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id === undefined) return;
    const resolve = pending.get(message.id);
    if (!resolve) return;
    pending.delete(message.id);
    resolve(message.error ? { error: message.error } : { result: message.result });
  });
  return process_;
}

/** Envoie une requête JSON-RPC au serveur enveloppé et attend sa réponse. */
function forward(request: unknown): Promise<unknown> {
  if (!child) child = startWrapped();
  const id = (request as { id?: number | string }).id;
  const promise = new Promise((resolve) => {
    if (id !== undefined) pending.set(id, resolve);
  });
  child.stdin.write(`${JSON.stringify(request)}\n`);
  return promise;
}

interface ToolCall {
  name?: string;
  arguments?: Record<string, unknown>;
}

/** Résume un appel d'outil en une ligne lisible pour la timeline. */
function describe(name: string, args: Record<string, unknown>): string {
  const file = args.path ?? args.file ?? args.filePath;
  const command = args.command;
  if (typeof file === "string") return `${name}:${file}`;
  if (typeof command === "string") return `${name}: ${command.slice(0, 80)}`;
  return name;
}

/** Capture l'état si et seulement s'il a changé depuis le dernier checkpoint. */
function capture(toolName: string, args: Record<string, unknown>): number | null {
  try {
    const entry = captureCheckpointIfChanged({
      repo: REPO,
      session: SESSION,
      tool: toolName,
      action: describe(toolName, args),
    });
    if (entry) process.stderr.write(`rejeu-proxy : checkpoint #${entry.index} (${entry.action})\n`);
    return entry ? entry.index : null;
  } catch (error) {
    process.stderr.write(`rejeu-proxy : capture impossible — ${error instanceof Error ? error.message : String(error)}\n`);
    return null;
  }
}

/**
 * Fait passer l'appel par le hook (checkpoint-guard). Si le hook refuse
 * (code 2), l'appel n'est **pas** transmis : la commande destructrice
 * n'atteint jamais l'agent ni le dépôt.
 */
function checkHook(name: string, args: Record<string, unknown>): string | null {
  if (!HOOK || !existsSync(HOOK)) return null;
  const payload = JSON.stringify({ command: args.command ?? "", tool: name });
  const result = spawnSync("bash", [HOOK], { input: payload, encoding: "utf8" });
  if (result.status === 2) return result.stderr?.trim() || "refusé par le hook";
  return null;
}

async function handle(message: Record<string, unknown>): Promise<void> {
  const id = message.id;
  const method = String(message.method ?? "");
  const params = (message.params as Record<string, unknown> | undefined) ?? {};

  if (method === "initialize") {
    const response = await forward(message);
    const result = (response as { result?: Record<string, unknown> }).result ?? {};
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { ...result, serverInfo: { name: "rejeu-proxy", version: "0.1.0" } } })}\n`);
    return;
  }
  if (method === "notifications/initialized" || method.startsWith("notifications/")) {
    if (child) child.stdin.write(`${JSON.stringify(message)}\n`);
    return;
  }
  if (method === "tools/list") {
    const response = await forward(message);
    const result = (response as { result?: { tools?: unknown[] } }).result ?? {};
    const tools = [...(result.tools ?? []), {
      name: "rejeu_verify_chain",
      description: "Vérifie la chaîne d'attestation de la session capturée par le proxy.",
      inputSchema: { type: "object", properties: { session: { type: "string" } } },
    }];
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { ...result, tools } })}\n`);
    return;
  }
  if (method === "tools/call") {
    const name = String((params.name as string) ?? "");
    if (name === "rejeu_verify_chain") {
      const result = verifyChain({ session: SESSION, repo: REPO, createdAt: "", entries: [] });
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: !result.ok } })}\n`);
      return;
    }
    const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
    const refusal = checkHook(name, args);
    if (refusal) {
      process.stderr.write(`rejeu-proxy : appel refusé par le hook — ${refusal.split("\n")[0]}\n`);
      process.stdout.write(`${JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: refusal }], isError: true },
      })}\n`);
      return;
    }
    const response = await forward(message);
    capture(name, args);
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, ...(response as object) })}\n`);
    return;
  }
  const response = await forward(message);
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, ...(response as object) })}\n`);
}

const reader = createInterface({ input: process.stdin });
reader.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    void handle(JSON.parse(trimmed) as Record<string, unknown>);
  } catch (error) {
    process.stderr.write(`rejeu-proxy : ${error instanceof Error ? error.message : String(error)}\n`);
  }
});
