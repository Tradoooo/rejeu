import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { extractTree } from "./store.ts";
import type { Checkpoint, RunResult } from "./types.ts";

export interface PredicateOptions {
  /** Commande exécutée dans le bac à sable, par exemple `node --test test/parser.test.js`. */
  predicate: string;
  /** Budget par exécution, en millisecondes. */
  timeoutMs?: number;
  /** Couper le réseau (`unshare -n`) quand le noyau l'autorise. */
  cutNetwork?: boolean;
}

let unshareAvailable: boolean | null = null;

/** `unshare -n` n'est pas disponible partout (conteneurs, noyau restreint). */
export function canCutNetwork(): boolean {
  if (unshareAvailable !== null) return unshareAvailable;
  const probe = spawnSync("unshare", ["-n", "true"], { encoding: "utf8" });
  unshareAvailable = probe.status === 0;
  return unshareAvailable;
}

/** Environnement du bac à sable : horloge logique, pas de credentials, HOME jetable. */
function sandboxEnv(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(GIT_|GH_|GITHUB_|AWS_|OPENAI|ANTHROPIC|KIRO)/.test(key)) delete env[key];
  }
  return {
    ...env,
    HOME: home,
    TMPDIR: home,
    TZ: "UTC",
    SOURCE_DATE_EPOCH: "0",
    CI: "1",
    NODE_ENV: "test",
    REJEU_SANDBOX: "1",
  };
}

/** Exécute une commande shell dans un répertoire, process group tuable. */
export function runShell(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string; ms: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bash", ["-c", command], { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const cap = 64 * 1024;
    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < cap) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < cap) stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, ms: Date.now() - started, timedOut });
    });
  });
}

/** Crée un bac à sable, y extrait un checkpoint, et le détruit après usage. */
export async function runAtCheckpoint(
  repo: string,
  checkpoint: Checkpoint,
  options: PredicateOptions,
): Promise<RunResult> {
  const root = mkdtempSync(join(tmpdir(), "rejeu-sandbox-"));
  const work = join(root, "work");
  const home = join(root, "home");
  mkdirSync(work, { recursive: true });
  mkdirSync(home, { recursive: true });
  try {
    extractTree(repo, checkpoint.tree, work);
    writeFileSync(join(home, ".rejeu"), "sandbox\n", "utf8");
    const cut = options.cutNetwork !== false && canCutNetwork();
    const command = cut ? `unshare -n bash -c ${JSON.stringify(options.predicate)}` : options.predicate;
    const run = await runShell(command, work, sandboxEnv(home), options.timeoutMs ?? 120_000);
    return {
      ok: run.code === 0,
      code: run.code,
      ms: run.ms,
      timedOut: run.timedOut,
      stdout: run.stdout,
      stderr: run.stderr,
      networkCut: cut,
      sandbox: work,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
