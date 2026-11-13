/** Motifs `.replayignore` : globs simples, une entrée par ligne, `#` commente. */
export function parseIgnoreFile(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"));
}

function globToRegExp(pattern: string): RegExp {
  if (pattern.endsWith("/")) {
    const prefix = pattern.slice(0, -1).replace(/\./g, "\\.");
    return new RegExp(`^${prefix}(/.*)?$`);
  }
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i] as string;
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}(/.*)?$`);
}

/** Vrai si le chemin est couvert par au moins un motif. */
export function isIgnored(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}
