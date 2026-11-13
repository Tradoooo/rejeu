import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { makeEntry, verifyChain } from "./chain.ts";
import { git, gitEnv, gitOrThrow, isSha } from "./git.ts";
import { isIgnored, parseIgnoreFile } from "./ignore.ts";
import { sha256 } from "./hash.ts";
import type { Chain, Checkpoint } from "./types.ts";

export const REPLAY_DIR = ".replay";
export const IGNORE_FILE = ".replayignore";

export function replayPath(repo: string, session?: string): string {
  return session ? join(repo, REPLAY_DIR, session) : join(repo, REPLAY_DIR);
}

export function chainPath(repo: string, session: string): string {
  return join(replayPath(repo, session), "chain.json");
}

/** Motifs exclus de toute capture : `.replay/` est le journal, jamais un état. */
export const ALWAYS_IGNORED = [".replay/", ".git/", "node_modules/"];

export function readIgnore(repo: string): string[] {
  const path = join(repo, IGNORE_FILE);
  const declared = existsSync(path) ? parseIgnoreFile(readFileSync(path, "utf8")) : [];
  return [...ALWAYS_IGNORED, ...declared];
}

/** Charge une chaîne ; renvoie null si la session n'existe pas. */
export function loadChain(repo: string, session: string): Chain | null {
  const path = chainPath(repo, session);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Chain;
}

export function saveChain(repo: string, chain: Chain): void {
  mkdirSync(replayPath(repo, chain.session), { recursive: true });
  writeFileSync(chainPath(repo, chain.session), `${JSON.stringify(chain, null, 2)}\n`, "utf8");
}

/** Sessions capturées présentes sur le disque (état « vide » de l'interface). */
export function listSessions(repo: string): string[] {
  const root = replayPath(repo);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function indexWithTempFile(repo: string, env: Record<string, string>): void {
  const hasHead = git(repo, ["rev-parse", "--verify", "-q", "HEAD"]).code === 0;
  if (hasHead) gitOrThrow(repo, ["read-tree", "HEAD"], env);
}

function dropIgnoredPaths(repo: string, env: Record<string, string>, patterns: string[]): void {
  if (patterns.length === 0) return;
  const listed = gitOrThrow(repo, ["ls-files", "-z"], env).split("\0").filter(Boolean);
  const doomed = listed.filter((path) => isIgnored(path, patterns));
  for (let start = 0; start < doomed.length; start += 200) {
    const chunk = doomed.slice(start, start + 200);
    git(repo, ["update-index", "--force-remove", "--", ...chunk], env);
  }
}

export interface CaptureOptions {
  repo: string;
  session: string;
  tool: string;
  action: string;
  at?: string;
  outside?: Record<string, string>;
}

/**
 * Capture un checkpoint sans toucher à l'index ni à l'arbre de travail :
 * l'index est un fichier temporaire, l'arbre est écrit dans la base d'objets.
 */
export function captureCheckpoint(options: CaptureOptions): Checkpoint {
  const { repo, session, tool, action } = options;
  const tempIndex = join(tmpdir(), `rejeu-index-${randomUUID()}`);
  const env = { GIT_INDEX_FILE: tempIndex };
  try {
    indexWithTempFile(repo, env);
    gitOrThrow(repo, ["add", "-A", "--", "."], env);
    dropIgnoredPaths(repo, env, readIgnore(repo));
    const tree = gitOrThrow(repo, ["write-tree"], env);
    const chain = loadChain(repo, session) ?? {
      session,
      repo,
      createdAt: options.at ?? new Date().toISOString(),
      entries: [],
    };
    const previous = chain.entries.at(-1) ?? null;
    const entry = makeEntry(previous, {
      tree,
      parentTree: previous ? previous.tree : null,
      tool,
      action,
      at: options.at ?? logicalNow(),
      outside: options.outside ?? {},
    });
    chain.entries.push(entry);
    saveChain(repo, chain);
    return entry;
  } finally {
    rmSync(tempIndex, { force: true });
    rmSync(`${tempIndex}.lock`, { force: true });
  }
}

/** Horloge logique par défaut : SOURCE_DATE_EPOCH, sinon l'instant UTC arrondi. */
export function logicalNow(): string {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const ms = epoch && /^\d+$/.test(epoch) ? Number(epoch) * 1000 : Date.now();
  return new Date(ms).toISOString();
}

/** Extrait un arbre dans un répertoire (jetable) — jamais dans le dépôt hôte. */
export function extractTree(repo: string, tree: string, destination: string): void {
  if (!isSha(tree)) throw new Error(`arbre invalide : ${tree}`);
  mkdirSync(destination, { recursive: true });
  const result = spawnSync("sh", ["-c", `git archive --format=tar ${tree} | tar -x -C ${JSON.stringify(destination)}`], {
    cwd: repo,
    env: gitEnv(),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`extraction ${tree} : ${result.stderr || result.status}`);
}

/** Empreinte du dépôt hôte : sert à prouver que le sandbox n'a rien écrit. */
export function hostDigest(repo: string): string {
  const head = git(repo, ["rev-parse", "--verify", "-q", "HEAD"]).stdout || "no-head";
  const status = git(repo, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout;
  // `.replay/` est notre propre journal : il ne fait pas partie de l'état du dépôt.
  const filtered = status
    .split("\0")
    .filter((entry) => entry.length > 0 && !entry.slice(3).startsWith(`${REPLAY_DIR}/`))
    .join("\0");
  return sha256(`${head}\n${filtered}`);
}

export function verifySession(repo: string, session: string) {
  const chain = loadChain(repo, session);
  if (!chain) throw new Error(`session inconnue : ${session}`);
  return verifyChain(chain);
}
