/**
 * isIgnored(path, patterns) -> boolean
 *
 * Teste si un chemin correspond à l'un des motifs glob (style .gitignore).
 *
 * Règles :
 *   - `*`    : n'importe quoi sauf `/`
 *   - `**`   : n'importe quoi, `/` compris
 *   - `?`    : exactement un caractère (jamais `/`)
 *   - motif terminé par `/` : préfixe de dossier (le dossier et son contenu)
 *   - tous les autres caractères sont littéraux
 *
 * Le motif est ancré sur le chemin complet : `*.txt` ne matche donc pas
 * `src/a.txt` (il faut `src/` + `*.txt`, ou un `**` en tête).
 *
 * ESM, sans dépendance.
 */

const LITERAL_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Échappe les caractères d'une expression régulière. */
function escapeLiteral(text) {
  return text.replace(LITERAL_ESCAPE, '\\$&');
}

/**
 * Traduit un segment de motif en source regex :
 * `**` -> `.*`, `*` -> `[^/]*`, `?` -> `[^/]`, le reste est littéral.
 */
function translateSegment(segment) {
  let out = '';
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (ch === '*') {
      if (segment[i + 1] === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += escapeLiteral(ch);
    }
  }
  return out;
}

/**
 * Traduit un motif complet en source regex (sans ancres).
 * Un segment `**` :
 *   - en dernière position -> `.*` (tout ce qui suit) ;
 *   - ailleurs -> zéro ou plusieurs dossiers, séparateur inclus.
 */
function patternToSource(pattern) {
  const segments = pattern.split('/');
  let source = '';
  let pendingSlash = false;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    if (pendingSlash) {
      source += '/';
      pendingSlash = false;
    }
    if (segment === '**') {
      source += isLast ? '.*' : '(?:[^/]*/)*';
      pendingSlash = false;
      continue;
    }
    source += translateSegment(segment);
    pendingSlash = true;
  }
  return source;
}

/** Normalise un chemin : séparateurs, `./` en tête, `/` de fin. */
function normalizePath(path) {
  return String(path ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/');
}

/** Normalise un motif : séparateurs, `./` en tête, `/` de fin. */
function normalizePattern(pattern) {
  const value = String(pattern ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
  return { value, isDirPrefix: /\/\s*$/.test(String(pattern ?? '')) };
}

/** Liste de motifs tolérante (tableau ou chaîne unique), sans vides. */
function toPatternList(patterns) {
  if (typeof patterns === 'string') return [patterns];
  if (!Array.isArray(patterns)) return [];
  return patterns.filter((p) => typeof p === 'string' && p.trim() !== '');
}

/**
 * @param {string} path              chemin testé (ex. `src/app/log.txt`)
 * @param {string[]|string} patterns liste de motifs glob
 * @returns {boolean} true si au moins un motif correspond au chemin
 */
export function isIgnored(path, patterns) {
  const list = toPatternList(patterns);
  if (list.length === 0) return false;
  const normalizedPath = normalizePath(path);
  if (normalizedPath === '') return false;
  for (const raw of list) {
    const { value, isDirPrefix } = normalizePattern(raw);
    if (value === '') continue;
    const source = patternToSource(value);
    // Un motif dossier matche le dossier lui-même et tout son contenu.
    const regex = isDirPrefix
      ? new RegExp(`^${source}(?:/.*)?$`)
      : new RegExp(`^${source}$`);
    if (regex.test(normalizedPath)) return true;
  }
  return false;
}

export default isIgnored;
