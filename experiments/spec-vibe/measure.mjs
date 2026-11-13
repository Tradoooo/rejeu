/**
 * Mesure de l'expérience spec / vibe coding.
 *
 * La MÊME suite de tests est exécutée contre les deux implémentations ;
 * c'est la mesure objective (défauts = tests en échec à la fin).
 */
import { cpSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const variants = ["spec", "vibe"];
const rows = [];

for (const variant of variants) {
  const dir = join(root, variant);
  const test = readFileSync(join(root, "tests", "glob.test.mjs"), "utf8").replace('from "../impl.mjs"', 'from "./impl.mjs"');
  writeFileSync(join(dir, "glob.test.mjs"), test);
  const started = Date.now();
  const result = spawnSync("node", ["--test", "glob.test.mjs"], { cwd: dir, encoding: "utf8" });
  const duration = Date.now() - started;
  const output = `${result.stdout ?? ""}`;
  const failed = Number(output.match(/fail (\d+)/)?.[1] ?? "0");
  const passed = Number(output.match(/pass (\d+)/)?.[1] ?? "0");
  const ownTest = join(dir, "impl.test.mjs");
  const own = existsSync(ownTest) ? readFileSync(ownTest, "utf8") : "";
  const ownCases = (own.match(/\btest\(/g) ?? []).length;
  rows.push({
    variant,
    passed,
    failed,
    duration,
    ownTests: ownCases,
    lines: (readFileSync(join(dir, "impl.mjs"), "utf8").split("\n")).length,
  });
}

const table = rows.map((row) => `| ${row.variant} | ${row.passed} | ${row.failed} | ${row.ownTests} | ${row.lines} | ${(row.duration / 1000).toFixed(1)} s |`).join("\n");
writeFileSync(join(root, "mesure.json"), `${JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2)}\n`);
process.stdout.write(`${table}\n`);

