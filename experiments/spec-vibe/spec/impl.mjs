// isIgnored(path, patterns) -> boolean
// Correspondance d'un chemin de fichier contre une liste de motifs d'exclusion.
// Spécification EARS : REJ-IG-01 .. REJ-IG-08 (implémentation pure, ESM, sans dépendance).

// Caractères à échapper dans une expression régulière.
const REGEX_META = /[.*+?^${}()|[\]\\]/;

// Échappe un caractère pour qu'il soit matché littéralement (REJ-IG-07).
function escapeLiteral(ch) {
  return REGEX_META.test(ch) ? `\\${ch}` : ch;
}

// Traduit un motif glob en source d'expression régulière (sans ancres).
// `*`  -> suite de caractères sans `/`   (REJ-IG-03)
// `**` -> suite de caractères, `/` inclus (REJ-IG-04)
// `?`  -> exactement un caractère, pas `/` (REJ-IG-05)
// tout le reste est littéral (REJ-IG-07)
function globToSource(pattern) {
  let src = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // Segment complet `**/` : zéro ou plusieurs répertoires.
        if (pattern[i + 2] === '/' && (i === 0 || pattern[i - 1] === '/')) {
          src += '(?:[^]*/)?';
          i += 3;
          continue;
        }
        src += '[^]*';
        i += 2;
        continue;
      }
      src += '[^/]*';
      i += 1;
      continue;
    }
    if (ch === '?') {
      src += '[^/]';
      i += 1;
      continue;
    }
    src += escapeLiteral(ch);
    i += 1;
  }
  return src;
}

// Compile un motif en expression régulière ancrée.
// Un motif terminé par `/` est un préfixe de dossier : il couvre le dossier
// lui-même et tout ce qu'il contient, mais pas un simple voisin de préfixe
// (`dist/` ne matche pas `distribution/x`) — REJ-IG-06.
function patternToRegExp(pattern) {
  const isDir = pattern.endsWith('/');
  const body = isDir ? pattern.slice(0, -1) : pattern;
  const src = globToSource(body);
  return new RegExp(isDir ? `^${src}(/.*)?$` : `^${src}$`);
}

// Détermine si `path` est ignoré par l'un des `patterns`.
// Fonction pure : mêmes entrées -> même sortie, aucun effet de bord (REJ-IG-08).
export function isIgnored(path, patterns) {
  if (typeof path !== 'string' || !Array.isArray(patterns)) return false;
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue;
    // Correspondance exacte (REJ-IG-01).
    if (pattern === path) return true;
    if (patternToRegExp(pattern).test(path)) return true;
  }
  return false;
}

export default isIgnored;
