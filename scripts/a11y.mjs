/**
 * Contrôle d'accessibilité réel : `axe-core` exécuté dans Chromium sur chaque
 * page publiée. Zéro violation exigée, sinon sortie 1 (le job CI est requis).
 * Les pages sont servies par un petit serveur local : `file://` casse fetch().
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const root = resolve("apps/web/dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const PAGES = ["/", "/report.html", "/report-flaky.html", "/report-agent.html"];

const server = createServer(async (request, response) => {
  try {
    const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname));
    const file = path === "/" ? join(root, "index.html") : join(root, path);
    if (!file.startsWith(root)) throw new Error("hors racine");
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("absent");
  }
});

await new Promise((done) => server.listen(0, "127.0.0.1", done));
const { port } = server.address();
// Le navigateur est celui de la machine quand il existe (poste de travail),
// sinon celui de Chromium embarqué par Playwright ; en CI, Google Chrome
// préinstallé évite un téléchargement de navigateur dans le budget de 5 min.
let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ channel: "chrome" });
}
let failures = 0;

for (const page of PAGES) {
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`http://127.0.0.1:${port}${page}`, { waitUntil: "load" });
  // Démonstration : on parcourt les quatre états avant de mesurer.
  if (page === "/") {
    for (const state of ["chargement", "erreur", "succes", "vide"]) {
      await tab.click(`button[data-state="${state}"]`);
      await tab.waitForTimeout(150);
    }
  }
  const result = await new AxeBuilder({ page: tab }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const violations = result.violations;
  const contrast = result.incomplete.filter((item) => item.id === "color-contrast").length;
  process.stdout.write(`${page} — ${violations.length} violation(s), ${result.passes.length} règles passées${contrast ? `, ${contrast} contraste(s) non concluant(s)` : ""}\n`);
  for (const violation of violations) {
    process.stdout.write(`  ✕ ${violation.id} (${violation.impact}) × ${violation.nodes.length} : ${violation.help}\n`);
    for (const node of violation.nodes.slice(0, 3)) process.stdout.write(`     ${node.target.join(" ")}\n`);
  }
  failures += violations.length;
  await context.close();
}

await browser.close();
server.close();
process.stdout.write(failures === 0 ? "axe : 0 violation\n" : `axe : ${failures} violation(s)\n`);
process.exit(failures === 0 ? 0 : 1);
