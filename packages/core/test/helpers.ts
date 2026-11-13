import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Dépôt git réel, dans /tmp : les tests n'écrivent jamais dans un vrai projet. */
export function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "rejeu-test-"));
  run(dir, ["git", "init", "-q", "-b", "main"]);
  run(dir, ["git", "config", "user.email", "rejeu@example.invalid"]);
  run(dir, ["git", "config", "user.name", "Rejeu"]);
  return dir;
}

export function run(cwd: string, args: string[]): string {
  const result = spawnSync(args[0] as string, args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} : ${result.stderr}`);
  return (result.stdout ?? "").trim();
}

export function write(dir: string, path: string, content: string): void {
  const target = join(dir, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content, "utf8");
}

export function commit(dir: string, message: string): string {
  run(dir, ["git", "add", "-A"]);
  run(dir, ["git", "commit", "-q", "-m", message, "--allow-empty"]);
  return run(dir, ["git", "rev-parse", "HEAD"]);
}

/** Petit projet Node réel : un module et son test, exécutables par `node --test`. */
export function writeProject(dir: string, values: { parse: string; test: string }): void {
  write(dir, "package.json", JSON.stringify({ name: "fixture", type: "module", version: "1.0.0" }, null, 2));
  write(dir, "src/parser.js", values.parse);
  write(dir, "test/parser.test.js", values.test);
}

export const GOOD_PARSER = `export function parse(value) {\n  return value.split(",").map((part) => part.trim());\n}\n`;
export const BAD_PARSER = `export function parse(value) {\n  return value.split(",,").map((part) => part.trim());\n}\n`;
export const PARSER_TEST = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { parse } from "../src/parser.ts";\n\ntest("découpe sur la virgule", () => {\n  assert.deepEqual(parse("a,b,c"), ["a", "b", "c"]);\n});\n`;
