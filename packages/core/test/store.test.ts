import { afterEach, describe, expect, it } from "vitest";
import { rmSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { captureCheckpoint, extractTree, hostDigest, loadChain, readIgnore } from "../src/store.ts";
import { git } from "../src/git.ts";
import { commit, GOOD_PARSER, makeRepo, PARSER_TEST, run, write, writeProject } from "./helpers.ts";

const repos: string[] = [];

function repo(): string {
  const dir = makeRepo();
  repos.push(dir);
  return dir;
}

afterEach(() => {
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

describe("store de checkpoints", () => {
  it("capture un arbre par état, sans toucher à l'index ni au statut", () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état 1");
    const before = hostDigest(dir);

    const first = captureCheckpoint({ repo: dir, session: "s1", tool: "edit", action: "edit:src/parser.js" });
    expect(first.index).toBe(0);
    expect(first.parentTree).toBeNull();
    // Capturer ne modifie ni HEAD, ni l'index, ni l'arbre de travail.
    expect(hostDigest(dir)).toBe(before);

    write(dir, "src/parser.js", `${GOOD_PARSER}\n// modification\n`);
    const second = captureCheckpoint({ repo: dir, session: "s1", tool: "edit", action: "edit:src/parser.js" });
    expect(second.tree).not.toBe(first.tree);
    expect(second.parentTree).toBe(first.tree);

    const status = git(dir, ["status", "--porcelain"]).stdout;
    expect(status).toContain("src/parser.js");
    expect(readdirSync(join(dir, ".replay", "s1"))).toContain("chain.json");
  });

  it("écrit le même arbre pour deux captures du même état", () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état");
    const first = captureCheckpoint({ repo: dir, session: "s1", tool: "edit", action: "edit:src/parser.js" });
    const second = captureCheckpoint({ repo: dir, session: "s2", tool: "edit", action: "edit:src/parser.js" });
    expect(second.tree).toBe(first.tree);
  });

  it("exclut les chemins de .replayignore", () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    write(dir, ".replayignore", "dist/\n*.log\n# commentaire\n");
    write(dir, "dist/bundle.js", "généré\n");
    write(dir, "debug.log", "trace\n");
    commit(dir, "état");
    expect(readIgnore(dir)).toEqual([".replay/", ".git/", "node_modules/", "dist/", "*.log"]);

    const entry = captureCheckpoint({ repo: dir, session: "s1", tool: "bash", action: "build" });
    const listing = run(dir, ["git", "ls-tree", "-r", "--name-only", entry.tree]).split("\n");
    expect(listing).toContain("src/parser.js");
    expect(listing).not.toContain("dist/bundle.js");
    expect(listing).not.toContain("debug.log");
  });

  it("extrait un arbre dans un répertoire jetable", () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état");
    const entry = captureCheckpoint({ repo: dir, session: "s1", tool: "edit", action: "edit" });
    const destination = join(dir, "..", `extract-${Date.now()}`);
    extractTree(dir, entry.tree, destination);
    expect(readFileSync(join(destination, "src/parser.js"), "utf8")).toBe(GOOD_PARSER);
    rmSync(destination, { recursive: true, force: true });
  });

  it("recharge la chaîne depuis le disque", () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état");
    captureCheckpoint({ repo: dir, session: "s1", tool: "edit", action: "a" });
    captureCheckpoint({ repo: dir, session: "s1", tool: "edit", action: "b" });
    const chain = loadChain(dir, "s1");
    expect(chain?.entries.length).toBe(2);
  });
});

describe("les objets capturés sont protégés du gc", () => {
  it("crée une ref par checkpoint, pour que git gc ne les supprime pas", () => {
    const dir = repo();
    writeProject(dir, { parse: GOOD_PARSER, test: PARSER_TEST });
    commit(dir, "état");
    const entry = captureCheckpoint({ repo: dir, session: "protège", tool: "edit", action: "edit" });

    const refs = run(dir, ["git", "for-each-ref", "--format=%(refname) %(objectname)", "refs/rejeu"]).split("\n");
    expect(refs).toContain(`refs/rejeu/protège/0 ${entry.tree}`);
    // Sans cette ref, l'arbre serait non atteignable et `git gc --prune=now` l'effacerait.
    const reachable = run(dir, ["git", "rev-list", "--objects", "--all"]).includes(entry.tree);
    expect(reachable).toBe(true);
  });
});
