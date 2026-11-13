#!/usr/bin/env node
/**
 * Serveur MCP factice, enveloppé par le proxy pendant les tests.
 * Deux outils : `write_file` (mute le dépôt) et `read_file` (non mutant).
 */
import { createInterface } from "node:readline";
import { writeFileSync, readFileSync } from "node:fs";

const TOOLS = [
  { name: "write_file", description: "écrit un fichier", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } } },
  { name: "read_file", description: "lit un fichier", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
];

function reply(id, payload) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, ...payload })}\n`);
}

const reader = createInterface({ input: process.stdin });
reader.on("line", (line) => {
  const message = JSON.parse(line);
  const { id, method, params } = message;
  if (method === "initialize") {
    reply(id, { result: { protocolVersion: "2024-11-05", serverInfo: { name: "fake", version: "0.1.0" }, capabilities: { tools: {} } } });
    return;
  }
  if (method === "tools/list") {
    reply(id, { result: { tools: TOOLS } });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (name === "write_file") writeFileSync(args.path, args.content ?? "");
    if (name === "read_file") readFileSync(args.path, "utf8");
    reply(id, { result: { content: [{ type: "text", text: `ok:${name}` }], isError: false } });
    return;
  }
  reply(id, { result: {} });
});
