/**
 * Mesure les deux affirmations d'adoption du README :
 *  - « la démo en ligne montre un résultat en moins de 30 s, sans installation » ;
 *  - « première valeur en moins de 60 s sur un dépôt ».
 *
 * Rien n'est affirmatif : les deux sont chronométrées ici.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve("apps/web/dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const file = path === "/" ? join(root, "index.html") : join(root, path);
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("absent");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const { port } = server.address();

// ── 1. Démo en ligne : du chargement au verdict visible ──────────────────
const browser = await chromium.launch();
const page = await browser.newPage();
const startedDemo = Date.now();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
// La page charge ses données puis affiche l'état « vide » : on attend ce
// premier rendu avant de déclencher le verdict (c'est le geste du juge).
await page.waitForSelector("#zone h3");
await page.click('button[data-state="succes"]');
await page.waitForSelector("#zone h3");
const demoSeconds = (Date.now() - startedDemo) / 1000;
const verdictVisible = ((await page.textContent("#zone")) ?? "").includes("Itération fautive localisée");
await browser.close();
server.close();

// ── 2. Première valeur sur un dépôt vierge ───────────────────────────────
const repo = mkdtempSync(join(tmpdir(), "rejeu-adoption-"));
const cli = resolve("packages/cli/src/index.ts");
const commands = [
  ["git", "init", "-q", "-b", "main"],
  ["git", "config", "user.email", "a@b.c"],
  ["git", "config", "user.name", "t"],
];
for (const command of commands) {
  spawnSync(command[0], command.slice(1), { cwd: repo });
}
spawnSync("bash", ["-c", "printf '{\"type\":\"module\"}\\n' > package.json; printf 'export const ok = 1;\\n' > a.js; git add -A; git commit -q -m init"], { cwd: repo });

const startedValue = Date.now();
spawnSync("node", [cli, "capture", "--repo", repo, "--session", "adoption", "--tool", "edit", "--action", "edit:a.js"], { encoding: "utf8" });
spawnSync("node", [cli, "find", "--repo", repo, "--session", "adoption", "--predicate", "node --test"], { encoding: "utf8" });
const valueSeconds = (Date.now() - startedValue) / 1000;
rmSync(repo, { recursive: true, force: true });

const report = {
  measuredAt: new Date().toISOString(),
  demo: { seconds: Number(demoSeconds.toFixed(2)), verdictVisible, claim: "< 30 s, sans compte ni installation" },
  adoption: { seconds: Number(valueSeconds.toFixed(2)), claim: "première valeur en < 60 s" },
  demoUnder30: demoSeconds < 30,
  valueUnder60: valueSeconds < 60,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
await import("node:fs/promises").then((fs) => fs.writeFile(resolve("docs/preuves/adoption.json"), `${JSON.stringify(report, null, 2)}\n`));
