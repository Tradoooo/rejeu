/**
 * Contrôle d'accessibilité réel : `axe-core` exécuté dans Chromium sur chaque
 * page publiée. Zéro violation exigée, sinon sortie 1 (le job CI est requis).
 * Les pages sont servies par un petit serveur local : `file://` casse fetch().
 */
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
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
  // Garde-fou : une page qui ne rend rien ne doit pas pouvoir « passer » la
  // vérification d'accessibilité. On exige du contenu avant de mesurer.
  if (page === "/") {
    // Garde-fou : une page qui ne rend rien ne doit pas pouvoir « passer » la
    // vérification d'accessibilité. On exige du contenu avant de mesurer.
    await tab.waitForSelector("#zone h3", { timeout: 10_000 }).catch(() => undefined);
    const content = await tab.evaluate(() => (document.querySelector("#zone")?.textContent ?? "").trim());
    if (content.length < 40) {
      process.stdout.write("✕ la démonstration ne rend pas de contenu : mesure refusée\n");
      failures += 1;
    }
  }
  // Démonstration : on parcourt les quatre états avant de mesurer.
  if (page === "/") {
    for (const state of ["succes", "chargement", "erreur", "vide"]) {
      await tab.click(`button[data-state="${state}"]`);
      await tab.waitForTimeout(200);
    }
  }
  const result = await new AxeBuilder({ page: tab }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const violations = result.violations;
  const contrast = result.incomplete.filter((item) => item.id === "color-contrast");
  const contrastCount = contrast.length;
  process.stdout.write(`${page} — ${violations.length} violation(s), ${result.passes.length} règles passées${contrastCount ? `, ${contrastCount} contraste(s) non concluant(s)` : ""}\n`);
  for (const item of contrast) {
    for (const node of item.nodes) {
      process.stdout.write(`  ? contraste non conclu : ${node.target.join(" ")} — ${node.failureSummary?.replace(/\n/g, " ").slice(0, 160)}\n`);
    }
  }
  for (const violation of violations) {
    process.stdout.write(`  ✕ ${violation.id} (${violation.impact}) × ${violation.nodes.length} : ${violation.help}\n`);
    for (const node of violation.nodes.slice(0, 3)) process.stdout.write(`     ${node.target.join(" ")}\n`);
  }
  failures += violations.length;
  await context.close();
}

// ── Navigation clavier et mouvement réduit ──────────────────────────────
// La grille exige une navigation clavier complète, un focus visible et le
// respect de `prefers-reduced-motion`. Ces trois faits sont mesurés ici.
const keyboard = await browser.newContext();
const tab = await keyboard.newPage();
await tab.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
const focusTrail = [];
for (let step = 0; step < 12; step += 1) {
  await tab.keyboard.press("Tab");
  const info = await tab.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      text: (element.textContent ?? "").trim().slice(0, 28),
      outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
    };
  });
  if (info) focusTrail.push(info);
}
const withFocus = focusTrail.filter((item) => item.outline).length;
const uniqueTargets = new Set(focusTrail.map((item) => `${item.tag}:${item.text}`)).size;
process.stdout.write(`clavier — ${focusTrail.length} éléments focalisés, ${uniqueTargets} distincts, ${withFocus} avec focus visible\n`);
if (focusTrail.length < 4 || withFocus !== focusTrail.length) {
  process.stdout.write("✕ navigation clavier incomplète ou focus invisible\n");
  failures += 1;
}

const reduced = await browser.newContext({ reducedMotion: "reduce" });
const calm = await reduced.newPage();
await calm.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
const durations = await calm.evaluate(() => {
  const element = document.querySelector(".bar > span") ?? document.body;
  const style = getComputedStyle(element);
  return { transition: style.transitionDuration, animation: style.animationDuration };
});
const still = durations.transition === "0s" && durations.animation === "0s";
process.stdout.write(`prefers-reduced-motion — transition ${durations.transition}, animation ${durations.animation} → ${still ? "respecté" : "NON RESPECTÉ"}\n`);
if (!still) failures += 1;

// ── Preuves visuelles : thème clair et thème sombre ─────────────────────
await mkdir(resolve("docs/preuves"), { recursive: true });
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
  const shot = await context.newPage();
  await shot.goto(`http://127.0.0.1:${port}/report-agent.html`, { waitUntil: "load" });
  await shot.screenshot({ path: resolve("docs/preuves", `rapport-${scheme}.png`), fullPage: false });
  await context.close();
}
process.stdout.write("captures : docs/preuves/rapport-light.png, rapport-dark.png\n");

await keyboard.close();
await reduced.close();
await browser.close();
server.close();
process.stdout.write(failures === 0 ? "axe : 0 violation\n" : `axe : ${failures} violation(s)\n`);
process.exit(failures === 0 ? 0 : 1);
