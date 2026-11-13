#!/usr/bin/env node
/**
 * Serveur MCP de fichiers, minimal, en exemple.
 *
 * Il sert de « serveur enveloppé » pour le proxy non coopératif : l'agent
 * écrit des fichiers par son intermédiaire, et le proxy capture l'état du
 * dépôt **sans que l'agent ait à coopérer**.
 *
 * Outils : write_file, read_file, list_dir, bash.
 */
import { createInterface } from "node:readline";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const TOOLS = [
  {
    name: "write_file",
    description: "Écrit un fichier (crée les dossiers si besoin).",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Lit un fichier.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "list_dir",
    description: "Liste le contenu d'un dossier.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "bash",
    description: "Exécute une commande shell dans un dossier.",
    inputSchema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] },
  },
];

function reply(id, payload) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, ...payload })}\n`);
}

function result(id, text) {
  reply(id, { result: { content: [{ type: "text", text }], isError: false } });
}

function error(id, message) {
  reply(id, { result: { content: [{ type: "text", text: message }], isError: true } });
}

const reader = createInterface({ input: process.stdin });
reader.on("line", (line) => {
  const message = JSON.parse(line);
  const { id, method, params } = message;
  if (method === "initialize") {
    reply(id, { result: { protocolVersion: "2024-11-05", serverInfo: { name: "fs-mcp", version: "0.1.0" }, capabilities: { tools: {} } } });
    return;
  }
  if (method === "tools/list") {
    reply(id, { result: { tools: TOOLS } });
    return;
  }
  if (method !== "tools/call") {
    reply(id, { result: {} });
    return;
  }
  const name = params?.name;
  const args = params?.arguments ?? {};
  try {
    if (name === "write_file") {
      mkdirSync(dirname(args.path), { recursive: true });
      writeFileSync(args.path, args.content ?? "");
      result(id, `écrit ${args.path}`);
      return;
    }
    if (name === "read_file") {
      result(id, readFileSync(args.path, "utf8"));
      return;
    }
    if (name === "list_dir") {
      result(id, readdirSync(args.path).join("\n"));
      return;
    }
    if (name === "bash") {
      const run = spawnSync("bash", ["-c", args.command ?? ""], { cwd: args.cwd ?? process.cwd(), encoding: "utf8" });
      const code = run.status ?? -1;
      if (code !== 0) {
        error(id, `code ${code}\n${(run.stderr ?? "").trim()}`);
        return;
      }
      result(id, (run.stdout ?? "").trim() || `code 0`);
      return;
    }
    error(id, `outil inconnu : ${name}`);
  } catch (failure) {
    error(id, failure instanceof Error ? failure.message : String(failure));
  }
});
