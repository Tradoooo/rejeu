import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { makeEntry, verifyChain } from "../src/chain.ts";
import { chainedDigest, sha256 } from "../src/hash.ts";
import type { Checkpoint } from "../src/types.ts";
import type { CheckpointFields } from "../src/chain.ts";

const SEED = Number(process.env.REJEU_SEED ?? 20261104);
const settings = { seed: SEED, numRuns: 150 };

const arbFields: fc.Arbitrary<CheckpointFields> = fc.record({
  tree: fc.hexaString({ minLength: 40, maxLength: 40 }),
  parentTree: fc.option(fc.hexaString({ minLength: 40, maxLength: 40 }), { nil: null }),
  tool: fc.constantFrom("edit", "write", "bash", "commit"),
  action: fc.string({ maxLength: 40 }),
  at: fc.constant("2026-11-13T10:00:00.000Z"),
  outside: fc.constant({}),
});

/** Chaîne de `size` entrées, tirées d'une graine : reproductible à l'identique. */
function chainOf(size: number, seed: number): Checkpoint[] {
  const drawn = fc.sample(arbFields, { numRuns: size, seed });
  const entries: Checkpoint[] = [];
  for (const fields of drawn) {
    const previous = entries.at(-1) ?? null;
    // Le parent est une conséquence de la chaîne, jamais un tirage libre.
    entries.push(makeEntry(previous, { ...fields, parentTree: previous ? previous.tree : null }));
  }
  return entries;
}

function asChain(entries: Checkpoint[]) {
  return { session: "p", repo: ".", createdAt: "2026-11-13T10:00:00.000Z", entries };
}

describe("propriétés REJ-P (fast-check)", () => {
  // REJ-P-01 : une entrée est une fonction déterministe de son contenu et du prédécesseur.
  it("P-01 · même contenu + même prédécesseur ⇒ même digest", () => {
    fc.assert(
      fc.property(arbFields, fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }), { nil: null }), (fields, previous) => {
        const first = chainedDigest(previous, { index: 3, ...fields });
        const second = chainedDigest(previous, { ...fields, index: 3 });
        return first === second;
      }),
      settings,
    );
  });

  // REJ-P-02 : toute altération d'une entrée rompt la vérification.
  it("P-02 · altérer une entrée fait échouer verifyChain", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 0, max: 7 }), fc.string({ minLength: 1, maxLength: 12 }), (size, wanted, injection) => {
        const entries = chainOf(size, SEED + size);
        const chain = asChain(entries);
        if (!verifyChain(chain).ok) return false;
        const position = Math.min(wanted, entries.length - 1);
        const target = entries[position];
        if (!target) return false;
        target.action = `${target.action}${injection}`;
        return verifyChain(chain).ok === false;
      }),
      settings,
    );
  });

  // REJ-P-03 : le digest change dès que le contenu change (pas de collision de forme).
  it("P-03 · deux contenus différents donnent deux digests différents", () => {
    fc.assert(
      fc.property(arbFields, fc.string({ minLength: 1, maxLength: 8 }), (fields, suffix) => {
        const digestA = chainedDigest(null, { index: 0, ...fields });
        const digestB = chainedDigest(null, { index: 0, ...fields, action: `${fields.action}${suffix}` });
        return digestA !== digestB || `${fields.action}${suffix}` === fields.action;
      }),
      settings,
    );
  });

  // REJ-P-04 : la numérotation est continue, jamais un trou.
  it("P-04 · les index des entrées construites sont contigus", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (size) => {
        const entries = chainOf(size, SEED + size);
        return entries.every((entry, position) => entry.index === position);
      }),
      settings,
    );
  });

  // REJ-P-05 : le digest ne dépend pas de l'ordre des clés sérialisées.
  it("P-05 · sérialisation canonique stable sous permutation de clés", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1, maxLength: 6 }), fc.integer()), (record) => {
        const reversed: Record<string, number> = {};
        for (const key of Object.keys(record).reverse()) reversed[key] = record[key]!;
        return chainedDigest(null, record) === chainedDigest(null, reversed);
      }),
      settings,
    );
  });

  // REJ-P-06 : deux captures du même état doivent produire le même arbre.
  // C'est la propriété qui a été violée pendant la construction (le journal
  //capturerait son propre journal) : le contre-exemple est rejoué sur le
  // code d'avant le correctif, voir docs/preuves/propriete-contre-exemple.txt.
  it("P-06 · deux captures du même état donnent le même arbre", async () => {
    const { captureCheckpoint } = await import("../src/store.ts");
    const { makeRepo, commit, write } = await import("./helpers.ts");
    const { rmSync } = await import("node:fs");

    await fc.assert(
      fc.asyncProperty(fc.array(fc.string({ maxLength: 12 }), { minLength: 1, maxLength: 3 }), async (contents) => {
        const repo = makeRepo();
        try {
          write(repo, "package.json", '{"type":"module"}');
          write(repo, "a.txt", contents.join("|"));
          commit(repo, "init");
          const first = captureCheckpoint({ repo, session: "p06", tool: "edit", action: "edit" });
          const second = captureCheckpoint({ repo, session: "p06", tool: "edit", action: "edit" });
          return first.tree === second.tree;
        } finally {
          rmSync(repo, { recursive: true, force: true });
        }
      }),
      { ...settings, numRuns: 20 },
    );
  });

  it("rappel : sha256 rend toujours 64 caractères", () => {
    for (let index = 0; index < 1000; index += 1) expect(sha256(`entrée-${index}`)).toHaveLength(64);
  });
});
