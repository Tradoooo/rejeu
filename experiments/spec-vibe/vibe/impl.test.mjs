import test from 'node:test';
import assert from 'node:assert/strict';
import { isIgnored } from './impl.mjs';

test('motif exact', () => {
  assert.equal(isIgnored('a.txt', ['a.txt']), true);
  assert.equal(isIgnored('ab.txt', ['a.txt']), false);
  assert.equal(isIgnored('src/a.txt', ['src/a.txt']), true);
});

test('les caractères spéciaux sont littéraux', () => {
  assert.equal(isIgnored('a+b.txt', ['a+b.txt']), true);
  assert.equal(isIgnored('ab.txt', ['a+b.txt']), false);
  assert.equal(isIgnored('axb', ['a.b']), false);
  assert.equal(isIgnored('a.b', ['a.b']), true);
});

test('* ne traverse pas le séparateur', () => {
  assert.equal(isIgnored('src/a.txt', ['*.txt']), false);
  assert.equal(isIgnored('a.txt', ['*.txt']), true);
  assert.equal(isIgnored('src/a.txt', ['src/*.txt']), true);
  assert.equal(isIgnored('src/profonds/a.txt', ['src/*.txt']), false);
  assert.equal(isIgnored('abc', ['a*c']), true);
  assert.equal(isIgnored('abbbc', ['a*c']), true);
});

test('** traverse les dossiers', () => {
  assert.equal(isIgnored('src/profonds/a.txt', ['src/**/*.txt']), true);
  assert.equal(isIgnored('src/a.txt', ['src/**/*.txt']), true);
  assert.equal(isIgnored('a.txt', ['**/a.txt']), true);
  assert.equal(isIgnored('x/y/a.txt', ['**/a.txt']), true);
  assert.equal(isIgnored('x/y/b.txt', ['**/a.txt']), false);
  assert.equal(isIgnored('a/b/c', ['a/**']), true);
});

test('? matche un seul caractère', () => {
  assert.equal(isIgnored('a1.txt', ['a?.txt']), true);
  assert.equal(isIgnored('a/b.txt', ['a?b.txt']), false);
  assert.equal(isIgnored('ab.txt', ['a?.txt']), true);
  assert.equal(isIgnored('abc.txt', ['a?.txt']), false);
  assert.equal(isIgnored('axb', ['a?b']), true);
  assert.equal(isIgnored('ab', ['a?b']), false);
});

test('préfixe de dossier', () => {
  assert.equal(isIgnored('dist/bundle.js', ['dist/']), true);
  assert.equal(isIgnored('dist/x/y.js', ['dist/']), true);
  assert.equal(isIgnored('dist', ['dist/']), true);
  assert.equal(isIgnored('distribution/x', ['dist/']), false);
  assert.equal(isIgnored('src/dist/x', ['dist/']), false);
});

test('plusieurs motifs', () => {
  assert.equal(isIgnored('x.log', ['*.log', 'dist/']), true);
  assert.equal(isIgnored('x.md', ['*.log', 'dist/']), false);
});

test('aucun motif', () => {
  assert.equal(isIgnored('x.log', []), false);
  assert.equal(isIgnored('x.log', ['']), false);
  assert.equal(isIgnored('x.log', null), false);
  assert.equal(isIgnored('x.log', undefined), false);
});

test('casse et normalisation', () => {
  assert.equal(isIgnored('A.TXT', ['*.txt']), false);
  assert.equal(isIgnored('./a.txt', ['a.txt']), true);
  assert.equal(isIgnored('a.txt', ['./a.txt']), true);
  assert.equal(isIgnored('build/', ['build/']), true);
});
