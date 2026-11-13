import { afterEach, describe, expect, it } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureCheckpoint, hostDigest, loadChain } from "../src/store.ts";
import { findFaulty } from "../src/find.ts";
import { BAD_PARSER, commit, GOOD_PARSER, makeRepo, PARSER_TEST, write, writeProject } from "./helpers.ts";

const repos: string[] = [];
function repo(): string {
  const dir = makeRepo();
  repos.push(dir);
  return dir;
}
afterEach(() => {
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

const PREDICATE = "node --test test/parser.test.js";

/** Sept checkpoints réels : le bug est introduit au #3 puis corrigé au #5. */
function captureSession(dir: string): void {
  writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
  commit(dir, "état initial");
  const steps = [GOOD_PARSER, GOOD_PARSER, BAD_PARSER, BAD_PARSER, GOOD_PARSER, GOOD_PARSER, GOOD_PARSER];
  for (const [index, parser] of steps.entries()) {
    write(dir, "src/parser.js", `${parser}\n// itération ${index}\n`);
    captureCheckpoint({ repo: dir, session: "a41f9c2", tool: "edit", action: `edit:src/parser.js#${index}` });
  }
}

describe("localisation de l'itération fautive", () => {
  it("désigne le checkpoint où le prédicat bascule, par exécution réelle", async () => {
    const dir = repo();
    captureSession(dir);
    const chain = loadChain(dir, "a41f9c2");
    expect(chain?.entries.length).toBe(7);
    const before = hostDigest(dir);

    const verdict = await findFaulty(dir, chain!, { predicate: PREDICATE, timeoutMs: 60_000 });

    expect(verdict.status).toBe("localise");
    expect(verdict.faultyIndex).toBe(2);
    expect(verdict.checkpointsRun).toBeGreaterThanOrEqual(3);
    expect(verdict.hostRepoUnchanged).toBe(true);
    expect(hostDigest(dir)).toBe(before);
    expect(verdict.durationMs).toBeGreaterThan(0);
  }, 120_000);

  it("ne touche jamais au dépôt hôte (aucun fichier écrit)", async () => {
    const dir = repo();
    captureSession(dir);
    const chain = loadChain(dir, "a41f9c2");
    const before = hostDigest(dir);
    await findFaulty(dir, chain!, { predicate: PREDICATE, timeoutMs: 60_000 });
    expect(hostDigest(dir)).toBe(before);
  }, 120_000);

  it("suspend le verdict quand le prédicat est non déterministe", async () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    // Compteur partagé entre les bacs à sable : le second passage réussit,
    // donc la bascule ne se reproduit pas → verdict suspendu, jamais deviné.
    const counter = join(tmpdir(), `rejeu-flaky-${Date.now()}-${Math.random()}`);
    writeFileSync(counter, "1");
    const flakyTest = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFileSync, existsSync, writeFileSync } from "node:fs";\nconst COUNTER = ${JSON.stringify(counter)};\ntest("instable", () => {\n  const seen = existsSync(COUNTER) ? Number(readFileSync(COUNTER, "utf8")) : 0;\n  writeFileSync(COUNTER, String(seen + 1));\n  assert.equal(seen % 2, 0);\n});\n`;
    write(dir, "test/flaky.test.js", flakyTest);
    commit(dir, "test instable");
    captureCheckpoint({ repo: dir, session: "flaky", tool: "write", action: "write:test/flaky.test.js" });
    const chain = loadChain(dir, "flaky");
    const verdict = await findFaulty(dir, chain!, { predicate: "node --test test/flaky.test.js", timeoutMs: 60_000 });
    expect(verdict.status).toBe("non-deterministe");
    expect(verdict.faultyTree).toBeNull();
  }, 120_000);

  it("rend « aucun » quand tous les checkpoints passent", async () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état");
    for (let index = 0; index < 3; index += 1) {
      write(dir, "src/parser.js", `${GOOD_PARSER}\n// ${index}\n`);
      captureCheckpoint({ repo: dir, session: "sain", tool: "edit", action: `edit#${index}` });
    }
    const chain = loadChain(dir, "sain");
    const verdict = await findFaulty(dir, chain!, { predicate: PREDICATE, timeoutMs: 60_000 });
    expect(verdict.status).toBe("aucun");
    expect(verdict.faultyIndex).toBeNull();
  }, 120_000);

  it("la dichotomie retrouve le même index et rejoue moins de checkpoints", async () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état");
    // 24 checkpoints, la bascule est au 17e : la dichotomie doit économiser.
    for (let index = 0; index < 24; index += 1) {
      const parser = index < 17 ? GOOD_PARSER : BAD_PARSER;
      write(dir, "src/parser.js", `${parser}\n// ${index}\n`);
      captureCheckpoint({ repo: dir, session: "mono", tool: "edit", action: `edit#${index}` });
    }
    const chain = loadChain(dir, "mono");
    const linear = await findFaulty(dir, chain!, { predicate: PREDICATE, timeoutMs: 60_000, mode: "lineaire" });
    const dichotomie = await findFaulty(dir, chain!, { predicate: PREDICATE, timeoutMs: 60_000, mode: "dichotomie" });
    expect(linear.faultyIndex).toBe(17);
    expect(dichotomie.faultyIndex).toBe(17);
    expect(dichotomie.checkpointsRun).toBeLessThan(linear.checkpointsRun);
  }, 180_000);
});
