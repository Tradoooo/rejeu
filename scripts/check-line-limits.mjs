/**
 * Garde-fou de structure (règle user 2026-10-24) : tout fichier de code fait
 * moins de 500 lignes, toute fonction moins de 50. Analyse par comptage
 * d'accolades — suffisant pour du TypeScript au style de ce dépôt, et sans
 * dépendance : le garde doit tourner en quelques secondes en CI.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const MAX_FILE = 500;
const MAX_FUNCTION = 50;
const ROOTS = ["packages", "apps", "scripts", "corpus"];
const EXTENSIONS = new Set([".ts", ".mjs", ".js", ".py"]);
const SKIP = new Set(["node_modules", "dist", ".replay", "fixtures"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (EXTENSIONS.has(name.slice(name.lastIndexOf(".")))) out.push(path);
  }
  return out;
}

/** Repère les déclarations de fonction et mesure leur corps par accolades. */
function longFunctions(source) {
  const lines = source.split("\n");
  const findings = [];
  const pattern = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*[(<]|^\s*(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>\s*\{/;
  for (const [index, line] of lines.entries()) {
    const match = pattern.exec(line);
    if (!match) continue;
    const name = match[1] ?? match[2];
    let depth = 0;
    let opened = false;
    let end = index;
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      for (const char of lines[cursor]) {
        if (char === "{") {
          depth += 1;
          opened = true;
        } else if (char === "}") {
          depth -= 1;
        }
      }
      if (opened && depth === 0) {
        end = cursor;
        break;
      }
    }
    const size = end - index + 1;
    if (opened && size > MAX_FUNCTION) findings.push({ name, start: index + 1, size });
  }
  return findings;
}

const root = resolve(".");
const files = ROOTS.flatMap((entry) => {
  try {
    return walk(join(root, entry));
  } catch {
    return [];
  }
});

let errors = 0;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const count = source.split("\n").length;
  const label = relative(root, file);
  if (count >= MAX_FILE) {
    process.stdout.write(`✕ ${label} : ${count} lignes (max ${MAX_FILE})\n`);
    errors += 1;
  }
  for (const finding of longFunctions(source)) {
    process.stdout.write(`✕ ${label}:${finding.start} ${finding.name}() : ${finding.size} lignes (max ${MAX_FUNCTION})\n`);
    errors += 1;
  }
}

process.stdout.write(errors === 0 ? `${files.length} fichiers contrôlés : structure conforme\n` : `${errors} dépassement(s)\n`);
process.exit(errors === 0 ? 0 : 1);
