/**
 * Construit le site statique : la page de démonstration, les rapports HTML
 * rendus depuis les exécutions enregistrées, et les données de la démo.
 * Aucune ressource externe : la page doit s'ouvrir hors ligne.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderReport, verifyChain } from "../packages/core/src/index.ts";

const root = resolve(".");
const out = join(root, "apps", "web", "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "data"), { recursive: true });

for (const file of ["index.html", "app.js", "style.css", "reel.html", "reel.js", "reel.css"]) {
  copyFileSync(join(root, "apps", "web", file), join(out, file));
}

const chain = JSON.parse(readFileSync(join(root, "fixtures", "demo", "chain.json"), "utf8"));
const verdictFile = JSON.parse(readFileSync(join(root, "fixtures", "demo", "verdict.json"), "utf8"));
const flaky = JSON.parse(readFileSync(join(root, "fixtures", "demo", "flaky.json"), "utf8"));

const generatedAt = new Date(Number(process.env.SOURCE_DATE_EPOCH ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
const { diff, verification: _ignored, sessionDigest, ...verdict } = verdictFile;
const predicate = verdictFile.predicate;
const html = renderReport({ chain, verdict, verification: verifyChain(chain), generatedAt });
writeFileSync(join(out, "report.html"), html, "utf8");
writeFileSync(
  join(out, "report-flaky.html"),
  renderReport({ chain: flaky.chain, verdict: flaky.verdict, verification: verifyChain(flaky.chain), generatedAt }),
  "utf8",
);

writeFileSync(
  join(out, "data", "verdict.json"),
  `${JSON.stringify({ verdict, chain, diff, predicate, verification: verifyChain(chain), sessionDigest }, null, 2)}\n`,
);
copyFileSync(join(root, "fixtures", "demo", "flaky.json"), join(out, "data", "flaky.json"));
copyFileSync(join(root, "fixtures", "reel.json"), join(out, "data", "reel.json"));

// La vidéo de démonstration (MP4 H.264) est publiée avec le site : elle montre
// des sorties réellement produites par scripts/capture-reel.mjs.
const demo = join(root, "docs", "demo", "rejeu-demo.mp4");
if (existsSync(demo)) {
  mkdirSync(join(out, "demo"), { recursive: true });
  copyFileSync(demo, join(out, "demo", "rejeu-demo.mp4"));
}

// Session réelle d'un agent (opencode + broker MCP), capturée le 13 nov. 2026 :
// le rapport est publié tel quel, et la chaîne brute est consultable.
const agentDir = join(root, "fixtures", "session-agent");
if (existsSync(join(agentDir, "report.html"))) {
  copyFileSync(join(agentDir, "report.html"), join(out, "report-agent.html"));
  copyFileSync(join(agentDir, "chain.json"), join(out, "data", "session-agent.json"));
}
writeFileSync(join(out, ".nojekyll"), "");
process.stdout.write(`site construit : ${out} (report.html, report-flaky.html, données de démo)\n`);
