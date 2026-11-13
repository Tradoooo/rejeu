import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { makeRepo, commit } from "../../core/test/helpers.ts";
import { loadChain, verifyChain } from "@rejeu/core";

type Proxy = ChildProcessByStdio<Writable, Readable, null>;

const repos: string[] = [];
const proxies: Proxy[] = [];

afterEach(() => {
  for (const proxy of proxies.splice(0)) proxy.kill("SIGKILL");
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

/** Démarre le proxy avec un serveur enveloppé factice. */
function startProxy(repo: string, session: string): Proxy {
  const server = resolve(__dirname, "fake-server.mjs");
  const proxy = spawn("node", [resolve(__dirname, "../src/server.ts")], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, REJEU_PROXY_COMMAND: `node ${server}`, REJEU_REPO: repo, REJEU_SESSION: session },
  }) as Proxy;
  proxies.push(proxy);
  return proxy;
}

/** Envoie une requête JSON-RPC et attend la réponse (par identifiant). */
function call(proxy: Proxy, id: number, method: string, params: unknown = {}): Promise<any> {
  return new Promise((resolve_) => {
    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split("\n")) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id !== id) continue;
        proxy.stdout.off("data", onData);
        resolve_(message);
      }
    };
    proxy.stdout.on("data", onData);
    proxy.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

describe("proxy MCP non coopératif", () => {
  it("présente les outils du serveur enveloppé et ajoute la vérification de chaîne", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const proxy = startProxy(repo, "proxy-1");

    const init = await call(proxy, 1, "initialize");
    expect(init.result.serverInfo.name).toBe("rejeu-proxy");

    const tools = await call(proxy, 2, "tools/list");
    const names = tools.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain("write_file");
    expect(names).toContain("read_file");
    expect(names).toContain("rejeu_verify_chain");
  });

  it("capture un checkpoint après un appel mutant, sans que l'agent le demande", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const proxy = startProxy(repo, "proxy-2");

    await call(proxy, 1, "initialize");
    await call(proxy, 2, "tools/call", { name: "write_file", arguments: { path: join(repo, "note.txt"), content: "écrit par le serveur enveloppé\n" } });

    expect(existsSync(join(repo, "note.txt"))).toBe(true);
    const chain = loadChain(repo, "proxy-2");
    expect(chain?.entries.length).toBe(1);
    expect(chain?.entries[0]?.tool).toBe("write_file");
    expect(chain?.entries[0]?.action).toContain("note.txt");
  });

  it("ne crée pas de checkpoint quand l'état n'a pas changé", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const proxy = startProxy(repo, "proxy-3");

    await call(proxy, 1, "initialize");
    await call(proxy, 2, "tools/call", { name: "write_file", arguments: { path: join(repo, "a.txt"), content: "un\n" } });
    await call(proxy, 3, "tools/call", { name: "read_file", arguments: { path: join(repo, "a.txt") } });

    const chain = loadChain(repo, "proxy-3");
    expect(chain?.entries.length).toBe(1);
  });

  it("chaîne les checkpoints dans l'ordre des appels", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const proxy = startProxy(repo, "proxy-4");

    await call(proxy, 1, "initialize");
    await call(proxy, 2, "tools/call", { name: "write_file", arguments: { path: join(repo, "b.txt"), content: "un\n" } });
    await call(proxy, 3, "tools/call", { name: "write_file", arguments: { path: join(repo, "c.txt"), content: "deux\n" } });

    const chain = loadChain(repo, "proxy-4");
    expect(chain?.entries.length).toBe(2);
    expect(chain?.entries[1]?.parentTree).toBe(chain?.entries[0]?.tree);
    expect(chain?.entries[0]?.tree).not.toBe(chain?.entries[1]?.tree);
  });
});

describe("la chaîne capturée par le proxy est vérifiable", () => {
  it("passe verifyChain après plusieurs appels capturés", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const proxy = startProxy(repo, "proxy-verif");

    await call(proxy, 1, "initialize");
    await call(proxy, 2, "tools/call", { name: "write_file", arguments: { path: join(repo, "x.txt"), content: "un\n" } });
    await call(proxy, 3, "tools/call", { name: "write_file", arguments: { path: join(repo, "y.txt"), content: "deux\n" } });

    const chain = loadChain(repo, "proxy-verif");
    expect(chain).not.toBeNull();
    const result = verifyChain(chain!);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
  });
});

describe("le hook applique par le proxy", () => {
  it("refuse un appel dont la commande est interdite, sans la transmettre", async () => {
    const repo = makeRepo();
    repos.push(repo);
    commit(repo, "init");
    const hook = resolve(__dirname, "../../../.kiro/hooks/checkpoint-guard.sh");
    const server = resolve(__dirname, "fake-server.mjs");
    const proxy = spawn("node", [resolve(__dirname, "../src/server.ts")], {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, REJEU_PROXY_COMMAND: `node ${server}`, REJEU_REPO: repo, REJEU_SESSION: "proxy-hook", REJEU_HOOK: hook },
    }) as Proxy;
    proxies.push(proxy);

    await call(proxy, 1, "initialize");
    const refused = await call(proxy, 2, "tools/call", { name: "bash", arguments: { command: "git commit --amend --no-edit" } });
    expect(refused.result.isError).toBe(true);
    expect(refused.result.content[0].text).toContain("checkpoint-guard");
    // L'appel refusé ne crée aucun checkpoint.
    expect(loadChain(repo, "proxy-hook")).toBeNull();
  });
});
