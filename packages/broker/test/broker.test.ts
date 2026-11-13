import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { makeRepo, commit } from "../../core/test/helpers.ts";
import { loadChain } from "@rejeu/core";

type Broker = ChildProcessByStdio<Writable, Readable, null>;

const repos: string[] = [];
const brokers: Broker[] = [];

afterEach(() => {
  for (const broker of brokers.splice(0)) broker.kill("SIGKILL");
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

function startBroker(repo: string, session: string): Broker {
  const broker = spawn("node", [resolve(__dirname, "../src/server.ts")], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, REJEU_REPO: repo, REJEU_SESSION: session },
  }) as Broker;
  brokers.push(broker);
  return broker;
}

function call(broker: Broker, id: number, method: string, params: unknown = {}): Promise<any> {
  return new Promise((resolve_) => {
    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split("\n")) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id !== id) continue;
        broker.stdout.off("data", onData);
        resolve_(message);
      }
    };
    broker.stdout.on("data", onData);
    broker.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

describe("broker MCP de rejeu", () => {
  it("annonce ses trois outils", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const broker = startBroker(repo, "broker-1");

    const init = await call(broker, 1, "initialize");
    expect(init.result.serverInfo.name).toBe("rejeu-broker");

    const tools = await call(broker, 2, "tools/list");
    const names = tools.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["replay_checkpoint", "first_faulty", "verify_chain"]));
  });

  it("enregistre un checkpoint sur demande et vérifie la chaîne", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const broker = startBroker(repo, "broker-2");

    await call(broker, 1, "initialize");
    const checkpoint = await call(broker, 2, "tools/call", { name: "replay_checkpoint", arguments: { tool: "edit", action: "edit:src/a.ts" } });
    expect(checkpoint.result.isError).toBe(false);
    const payload = JSON.parse(checkpoint.result.content[0].text);
    expect(payload.index).toBe(0);

    const chain = loadChain(repo, "broker-2");
    expect(chain?.entries.length).toBe(1);

    const verified = await call(broker, 3, "tools/call", { name: "verify_chain", arguments: {} });
    const report = JSON.parse(verified.result.content[0].text);
    expect(report.ok).toBe(true);
    expect(report.checked).toBe(1);
  });

  it("répond en erreur sans mourir quand l'outil est inconnu", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const broker = startBroker(repo, "broker-3");

    await call(broker, 1, "initialize");
    const failed = await call(broker, 2, "tools/call", { name: "outil_inexistant", arguments: {} });
    expect(failed.result.isError).toBe(true);

    // Le serveur répond toujours après l'erreur.
    const alive = await call(broker, 3, "tools/list");
    expect(alive.result.tools.length).toBeGreaterThan(0);
  });
});
