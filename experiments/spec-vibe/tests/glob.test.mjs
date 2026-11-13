// Suite de tests IDENTIQUE pour les deux implémentations (spec / vibe).
// C'est la mesure objective : combien de tests échouent à la fin.
import test from "node:test";
import assert from "node:assert/strict";
import { isIgnored } from "../impl.mjs";

test("motif exact", () => assert.equal(isIgnored("a.txt", ["a.txt"]), true));
test("motif exact ne prend pas le préfixe", () => assert.equal(isIgnored("ab.txt", ["a.txt"]), false));
test("etoile ne traverse pas le séparateur", () => assert.equal(isIgnored("src/a.txt", ["*.txt"]), false));
test("etoile traverse les dossiers", () => assert.equal(isIgnored("src/a.txt", ["src/*.txt"]), true));
test("double etoile traverse les dossiers", () => assert.equal(isIgnored("src/profonds/a.txt", ["src/**/*.txt"]), true));
test("double etoile au premier niveau", () => assert.equal(isIgnored("a.txt", ["**/a.txt"]), true));
test("interrogation simple", () => assert.equal(isIgnored("a1.txt", ["a?.txt"]), true));
test("point d'interrogation ne prend pas le séparateur", () => assert.equal(isIgnored("a/b.txt", ["a?b.txt"]), false));
test("préfixe de dossier", () => assert.equal(isIgnored("dist/bundle.js", ["dist/"]), true));
test("préfixe de dossier ne prend pas le préfixe commun", () => assert.equal(isIgnored("distribution/x", ["dist/"]), false));
test("plusieurs motifs", () => assert.equal(isIgnored("x.log", ["*.log", "dist/"]), true));
test("aucun motif", () => assert.equal(isIgnored("x.log", []), false));
test("les caractères spéciaux sont littéraux", () => assert.equal(isIgnored("a+b.txt", ["a+b.txt"]), true));
test("le point n'est pas un joker", () => assert.equal(isIgnored("axb", ["a.b"]), false));
