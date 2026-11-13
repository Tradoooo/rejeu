/**
 * Enregistre le reel de démonstration (scripts/capture-reel.mjs fournit les
 * sorties réelles), puis le convertit en MP4 H.264 lisible partout.
 *
 * Sortie : docs/demo/rejeu-demo.mp4 (+ la source webm conservée).
 */
import { createServer } from "node:http";
import { readFile, mkdir, stat, rm, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("apps/web/dist");
const outDir = resolve("docs/demo");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const file = join(root, path === "/" ? "reel.html" : path);
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("absent");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const { port } = server.address();

await mkdir(outDir, { recursive: true });
// Le répertoire de travail est vidé : une vidéo d'un run précédent ne doit
// jamais être ré-encodée à la place de la nouvelle.
await rm(join(outDir, "raw"), { recursive: true, force: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: join(outDir, "raw"), size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/reel.html`, { waitUntil: "load" });

// Le reel se termine quand la dernière scène est affichée (durée cumulée).
// La durée totale vient de la page (source unique de vérité du minutage).
const total = await page.evaluate(() => {
  const durations = window.REJUEL_DURATIONS ?? [];
  return durations.reduce((sum, value) => sum + value, 0);
});
await page.waitForTimeout(total + 2500);
await context.close();
await browser.close();
server.close();

const raw = join(outDir, "raw");
const files = await readdir(raw);
const webm = files.find((name) => name.endsWith(".webm"));
if (!webm) throw new Error("aucune vidéo produite");
const source = join(raw, webm);
const mp4 = join(outDir, "rejeu-demo.mp4");

const result = spawnSync("ffmpeg", ["-y", "-i", source, "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-movflags", "+faststart", mp4], { encoding: "utf8" });
if (result.status !== 0) throw new Error(`ffmpeg : ${result.stderr?.slice(-600)}`);
const info = await stat(mp4);
process.stdout.write(`vidéo : ${mp4} (${(info.size / 1024 / 1024).toFixed(1)} Mo)\n`);
