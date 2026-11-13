import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { captureCheckpoint } from "../src/store.ts";
import { commit, makeRepo, run, write, writeProject } from "./helpers.ts";
import { PARSER_TEST } from "./helpers.ts";

const repos: string[] = [];
function repo(): string {
  const dir = makeRepo();
  repos.push(dir);
  return dir;
}
afterEach(() => {
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

/**
 * CONTRE-EXEMPLE RÉEL — graine 20261104, consigné dans KIRO_JOURNAL.md.
 *
 * Propriété attendue : « deux captures de la même action donnent le même arbre ».
 * Elle est fausse dès qu'un fichier versionné embarque l'horloge murale :
 * `scripts/version.mjs` écrit `Date.now()` dans VERSION, donc deux exécutions
 * de la même action produisent deux arbres, et donc deux faux écarts.
 */
const VERSION_SCRIPT = `import { writeFileSync } from "node:fs";\nwriteFileSync("VERSION", String(Date.now()));\n`;

function buildProject(dir: string): void {
  writeProject(dir, { parse: "export const parse = (v) => v.split(\",\");\n", test: PARSER_TEST });
  write(dir, "scripts/version.mjs", VERSION_SCRIPT);
  commit(dir, "état initial");
}

describe("contre-exemple : l'horloge murale casse la stabilité des arbres", () => {
  it("échoue sans .replayignore : deux captures de la même action, deux arbres", () => {
    const dir = repo();
    buildProject(dir);
    run(dir, ["node", "scripts/version.mjs"]);
    const first = captureCheckpoint({ repo: dir, session: "horloge", tool: "bash", action: "node scripts/version.mjs" });
    run(dir, ["node", "scripts/version.mjs"]);
    const second = captureCheckpoint({ repo: dir, session: "horloge", tool: "bash", action: "node scripts/version.mjs" });
    // La propriété « même action ⇒ même arbre » est violée : c'est le défaut constaté.
    expect(second.tree).not.toBe(first.tree);
  });

  it("passe avec .replayignore + digest séparé : même action, même arbre", () => {
    const dir = repo();
    buildProject(dir);
    write(dir, ".replayignore", "VERSION\n");
    commit(dir, "exclure VERSION de l'état capturé");
    run(dir, ["node", "scripts/version.mjs"]);
    const first = captureCheckpoint({ repo: dir, session: "corrige", tool: "bash", action: "node scripts/version.mjs" });
    run(dir, ["node", "scripts/version.mjs"]);
    const second = captureCheckpoint({ repo: dir, session: "corrige", tool: "bash", action: "node scripts/version.mjs" });
    expect(second.tree).toBe(first.tree);
  });

  it("la propriété tient sur 20 répétitions une fois la correction appliquée", () => {
    const dir = repo();
    buildProject(dir);
    write(dir, ".replayignore", "VERSION\n");
    commit(dir, "exclure VERSION");
    const trees = new Set<string>();
    for (let runIndex = 0; runIndex < 20; runIndex += 1) {
      run(dir, ["node", "scripts/version.mjs"]);
      trees.add(captureCheckpoint({ repo: dir, session: "vingt", tool: "bash", action: "version" }).tree);
    }
    expect(trees.size).toBe(1);
  });
});
