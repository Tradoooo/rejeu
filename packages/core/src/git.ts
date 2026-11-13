import { spawnSync } from "node:child_process";

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Environnement git neutralisé : jamais GIT_DIR/GIT_INDEX_FILE hérités du parent. */
export function gitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, LC_ALL: "C", TZ: "UTC" };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_AUTHOR_NAME;
  return { ...env, ...extra };
}

export function git(repo: string, args: string[], extraEnv: Record<string, string> = {}): GitResult {
  const result = spawnSync("git", args, {
    cwd: repo,
    env: gitEnv(extraEnv),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: result.status ?? -1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

/** Échoue franchement plutôt que de rendre un résultat partiel. */
export function gitOrThrow(repo: string, args: string[], extraEnv: Record<string, string> = {}): string {
  const result = git(repo, args, extraEnv);
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr || result.code}`);
  return result.stdout;
}

export function isGitRepo(path: string): boolean {
  return git(path, ["rev-parse", "--git-dir"]).code === 0;
}

export function isSha(value: string): boolean {
  return /^[0-9a-f]{40,64}$/.test(value);
}
