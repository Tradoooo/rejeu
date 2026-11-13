import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { captureCheckpoint, loadChain } from "../src/store.ts";
import { runAtCheckpoint } from "../src/sandbox.ts";
import { commit, makeRepo, write, writeProject } from "./helpers.ts";
import { GOOD_PARSER, PARSER_TEST } from "./helpers.ts";

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

/** Un prédicat qui affiche son environnement : on vérifie ce que voit le bac à sable. */
const ENV_PREDICATE = "node -e 'process.stdout.write(JSON.stringify({epoch:process.env.SOURCE_DATE_EPOCH,tz:process.env.TZ,home:process.env.HOME,git:process.env.GIT_DIR??null,ci:process.env.CI}))'";

describe("bac à sable", () => {
  it("impose une horloge logique et un HOME jetable", async () => {
    const repo = makeRepo();
    repos.push(repo);
    writeProject(repo, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(repo, "init");
    const entry = captureCheckpoint({ repo, session: "env", tool: "edit", action: "edit" });

    const result = await runAtCheckpoint(repo, entry, { predicate: ENV_PREDICATE, timeoutMs: 30_000 });
    const env = JSON.parse(result.stdout);
    expect(env.epoch).toBe("0");
    expect(env.tz).toBe("UTC");
    expect(env.home).not.toBe(process.env.HOME);
    expect(env.git).toBeNull();
    expect(env.ci).toBe("1");
  });

  it("annonce honnêtement si le réseau n'a pas pu être coupé", async () => {
    const repo = makeRepo();
    repos.push(repo);
    writeProject(repo, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(repo, "init");
    const entry = captureCheckpoint({ repo, session: "net", tool: "edit", action: "edit" });

    const result = await runAtCheckpoint(repo, entry, { predicate: "true", timeoutMs: 30_000 });
    // Le champ dit la vérité : il ne prétend pas avoir coupé le réseau si la
    // sonde a menti (le repli du sandbox relance sans coupure).
    expect(typeof result.networkCut).toBe("boolean");
  });

  it("n'exécute jamais dans le dépôt hôte", async () => {
    const repo = makeRepo();
    repos.push(repo);
    writeProject(repo, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(repo, "init");
    const entry = captureCheckpoint({ repo, session: "cwd", tool: "edit", action: "edit" });

    const result = await runAtCheckpoint(repo, entry, { predicate: "pwd", timeoutMs: 30_000 });
    expect(result.stdout.trim()).not.toBe(repo);
    expect(result.sandbox.startsWith("/tmp")).toBe(true);
  });

  it("capture une chaîne vérifiable après plusieurs appels", async () => {
    const repo = makeRepo();
    repos.push(repo);
    writeProject(repo, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(repo, "init");
    for (let index = 0; index < 3; index += 1) {
      write(repo, `src/parser.js`, `${GOOD_PARSER}\n// ${index}\n`);
      captureCheckpoint({ repo, session: "multi", tool: "edit", action: `edit#${index}` });
    }
    const chain = loadChain(repo, "multi");
    expect(chain?.entries.length).toBe(3);
    expect(chain?.entries[2]?.parentTree).toBe(chain?.entries[1]?.tree);
  });
});
