#!/usr/bin/env node
/**
 * Testeur — exécute la suite de tests dans un bac à sable, sans réseau si
 * possible, en lecture seule sur le dépôt. Il n'écrit jamais dans le dépôt.
 *
 * Usage : node tools/testeur.mjs [--repo <dépôt>] [--commande "node --test"]
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const repo = resolve(value("repo", "."));
const command = value("commande", "pnpm test:run");
const network = spawnSync("unshare", ["-n", "true"], { encoding: "utf8" }).status === 0;
const started = Date.now();
const result = spawnSync("bash", ["-c", command], { cwd: repo, encoding: "utf8" });
const duration = Date.now() - started;
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const summary = output.split("\n").filter((line) => /Tests|Test Files|pass|fail/.test(line)).slice(-3).join(" | ");

process.stdout.write(`testeur : ${command} → code ${result.status ?? -1} en ${(duration / 1000).toFixed(1)} s · réseau ${network ? "coupé" : "NON COUPÉ (unshare refusé)"}\n${summary}\n`);
process.exit(result.status ?? 1);
