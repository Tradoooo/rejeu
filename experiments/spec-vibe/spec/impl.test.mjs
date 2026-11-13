// Tests de la spécification EARS pour isIgnored (REJ-IG-01 .. REJ-IG-08).
// Lancement : node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIgnored } from './impl.mjs';

/* ------------------------------------------------------------------ */
/* REJ-IG-01 : correspondance exacte                                    */
/* ------------------------------------------------------------------ */

test('REJ-IG-01 : le chemin exact dans les motifs est ignoré', () => {
  assert.equal(isIgnored('src/index.js', ['src/index.js']), true);
  assert.equal(isIgnored('a.txt', ['b.txt', 'a.txt']), true);
  assert.equal(isIgnored('', ['']), true);
});

test('REJ-IG-01 : le chemin exact est ignoré même avec des métacaractères de glob', () => {
  assert.equal(isIgnored('file[1].txt', ['file[1].txt']), true);
  assert.equal(isIgnored('a*b', ['a*b']), true);
  assert.equal(isIgnored('a?b', ['a?b']), true);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-02 : absence de correspondance                                */
/* ------------------------------------------------------------------ */

test('REJ-IG-02 : un motif qui ne correspond pas renvoie false', () => {
  assert.equal(isIgnored('src/index.js', ['lib/*.js']), false);
  assert.equal(isIgnored('src/index.js', ['*.css']), false);
  assert.equal(isIgnored('a.txt', ['b.txt']), false);
});

test('REJ-IG-02 : une liste de motifs vide renvoie false', () => {
  assert.equal(isIgnored('x', []), false);
  assert.equal(isIgnored('', []), false);
  assert.equal(isIgnored('dist/app.js', []), false);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-03 : `*` ne traverse pas `/`                                 */
/* ------------------------------------------------------------------ */

test('REJ-IG-03 : `*` correspond à une suite de caractères sans `/`', () => {
  assert.equal(isIgnored('a.txt', ['*.txt']), true);
  assert.equal(isIgnored('abc', ['a*c']), true);
  assert.equal(isIgnored('abc', ['*']), true);
  assert.equal(isIgnored('', ['*']), true);
});

test('REJ-IG-03 : `*` ne traverse pas `/`', () => {
  assert.equal(isIgnored('dir/a.txt', ['*.txt']), false);
  assert.equal(isIgnored('a/b/c', ['a*c']), false);
  assert.equal(isIgnored('a/b.txt', ['*/*.txt']), true);
  assert.equal(isIgnored('a/b/c.txt', ['*/*.txt']), false);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-04 : `**` traverse `/`                                       */
/* ------------------------------------------------------------------ */

test('REJ-IG-04 : `**` correspond à toute suite, `/` compris', () => {
  assert.equal(isIgnored('a/b/c.txt', ['a/**']), true);
  assert.equal(isIgnored('a/b/c.txt', ['**/c.txt']), true);
  assert.equal(isIgnored('a/b/c.txt', ['a/**/c.txt']), true);
  assert.equal(isIgnored('a/b/c/d/e', ['**']), true);
});

test('REJ-IG-04 : `**` traverse réellement plusieurs segments', () => {
  assert.equal(isIgnored('src/deep/nested/file.ts', ['src/**/*.ts']), true);
  assert.equal(isIgnored('src/file.ts', ['src/**/*.ts']), true);
  assert.equal(isIgnored('lib/deep/file.ts', ['src/**/*.ts']), false);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-05 : `?` exactement un caractère, pas `/`                    */
/* ------------------------------------------------------------------ */

test('REJ-IG-05 : `?` correspond à exactement un caractère', () => {
  assert.equal(isIgnored('a.txt', ['?.txt']), true);
  assert.equal(isIgnored('ab.txt', ['?.txt']), false);
  assert.equal(isIgnored('.txt', ['?.txt']), false);
});

test('REJ-IG-05 : `?` ne correspond pas à `/`', () => {
  assert.equal(isIgnored('a/b.txt', ['a?b.txt']), false);
  assert.equal(isIgnored('a/b', ['a?b']), false);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-06 : préfixe de dossier                                      */
/* ------------------------------------------------------------------ */

test('REJ-IG-06 : un motif terminé par `/` est un préfixe de dossier', () => {
  assert.equal(isIgnored('dist', ['dist/']), true);
  assert.equal(isIgnored('dist/app.js', ['dist/']), true);
  assert.equal(isIgnored('dist/a/b/c.js', ['dist/']), true);
});

test('REJ-IG-06 : `dist/` ne matche pas `distribution/x`', () => {
  assert.equal(isIgnored('distribution/x', ['dist/']), false);
  assert.equal(isIgnored('distribution', ['dist/']), false);
  assert.equal(isIgnored('dist-old/app.js', ['dist/']), false);
});

test('REJ-IG-06 : un motif sans `/` final reste une correspondance exacte', () => {
  assert.equal(isIgnored('dist', ['dist']), true);
  assert.equal(isIgnored('dist/app.js', ['dist']), false);
  // REJ-IG-03 : `*` ne traverse pas `/`, donc `dist*` ne matche pas `dist/app.js`
  assert.equal(isIgnored('dist/app.js', ['dist*']), false);
  assert.equal(isIgnored('dist-old', ['dist*']), true);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-07 : caractères littéraux                                    */
/* ------------------------------------------------------------------ */

test('REJ-IG-07 : `.` est littéral', () => {
  assert.equal(isIgnored('a.txt', ['a.txt']), true);
  assert.equal(isIgnored('axtxt', ['a.txt']), false);
  assert.equal(isIgnored('abc', ['a.c']), false);
  assert.equal(isIgnored('a.c', ['a.c']), true);
});

test('REJ-IG-07 : `+` est littéral', () => {
  assert.equal(isIgnored('a+b.txt', ['a+b.txt']), true);
  assert.equal(isIgnored('ab.txt', ['a+b.txt']), false);
  assert.equal(isIgnored('aab.txt', ['a+b.txt']), false);
});

test('REJ-IG-07 : les autres métacaractères sont littéraux', () => {
  assert.equal(isIgnored('a(b).txt', ['a(b).txt']), true);
  assert.equal(isIgnored('ab.txt', ['a(b).txt']), false);
  assert.equal(isIgnored('a|b.txt', ['a|b.txt']), true);
  assert.equal(isIgnored('axb.txt', ['a|b.txt']), false);
});

/* ------------------------------------------------------------------ */
/* REJ-IG-08 : pureté                                                 */
/* ------------------------------------------------------------------ */

test('REJ-IG-08 : la fonction est pure (entrée -> sortie déterministe)', () => {
  const patterns = ['dist/', '**/*.log', '*.tmp'];
  const first = isIgnored('a/b.log', patterns);
  const second = isIgnored('a/b.log', patterns);
  const third = isIgnored('a/b.log', patterns);
  assert.equal(first, second);
  assert.equal(second, third);
  assert.equal(first, true);
});

test('REJ-IG-08 : aucun effet de bord sur les arguments', () => {
  const patterns = ['dist/', '*.log'];
  const snapshot = [...patterns];
  isIgnored('dist/a', patterns);
  isIgnored('nope', patterns);
  assert.deepEqual(patterns, snapshot);
});

/* ------------------------------------------------------------------ */
/* Propriétés attendues                                               */
/* ------------------------------------------------------------------ */

test('propriété : l\'ordre des motifs n\'a pas d\'importance', () => {
  const a = ['dist/', '*.log', 'tmp/**'];
  const b = ['tmp/**', '*.log', 'dist/'];
  for (const path of ['dist/x', 'a.log', 'tmp/a/b', 'other']) {
    assert.equal(isIgnored(path, a), isIgnored(path, b));
  }
  assert.equal(isIgnored('dist/x', a), true);
});

test('propriété : ajouter un motif ne peut pas faire passer true à false', () => {
  const base = ['dist/', '*.log'];
  const enriched = [...base, 'tmp/**', 'exact/file.txt'];
  for (const path of ['dist/x', 'a.log', 'tmp/a/b', 'exact/file.txt', 'other']) {
    if (isIgnored(path, base) === true) {
      assert.equal(isIgnored(path, enriched), true);
    }
  }
});

test('propriété : isIgnored("x", []) vaut false', () => {
  assert.equal(isIgnored('x', []), false);
});

test('propriété : correspondance par segments pour `**` et `*` combinés', () => {
  // `*` ne traverse pas `/` : un seul segment intermédiaire
  assert.equal(isIgnored('src/main/kotlin/App.kt', ['src/*/kotlin/App.kt']), true);
  assert.equal(isIgnored('src/main/deep/kotlin/App.kt', ['src/*/kotlin/App.kt']), false);
  assert.equal(isIgnored('src/main/kotlin/App.kt', ['src/**/App.kt']), true);
  assert.equal(isIgnored('node_modules/pkg/index.js', ['node_modules/']), true);
  assert.equal(isIgnored('node_modules_old/pkg/index.js', ['node_modules/']), false);
});
