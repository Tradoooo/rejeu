import { describe, expect, it } from "vitest";
import { makeEntry, sessionDigest, verifyChain } from "../src/chain.ts";
import { canonical, chainedDigest } from "../src/hash.ts";
import type { Chain } from "../src/types.ts";
import type { CheckpointFields } from "../src/chain.ts";

const fields = (index: number): CheckpointFields => ({
  tree: `tree${index}`.padEnd(40, "0"),
  parentTree: index === 0 ? null : `tree${index - 1}`.padEnd(40, "0"),
  tool: "edit",
  action: `edit:file-${index}.ts`,
  at: `2026-11-13T10:0${index}:00.000Z`,
  outside: {},
});

function buildChain(count: number): Chain {
  const entries: Chain["entries"] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = entries.at(-1) ?? null;
    entries.push(makeEntry(previous, fields(index)));
  }
  return { session: "s1", repo: ".", createdAt: "2026-11-13T10:00:00.000Z", entries };
}

describe("chaîne d'attestation", () => {
  it("numérote et chaîne les entrées", () => {
    const chain = buildChain(4);
    expect(chain.entries.map((entry) => entry.index)).toEqual([0, 1, 2, 3]);
    expect(chain.entries[2]?.parentTree).toBe(chain.entries[1]?.tree);
    expect(verifyChain(chain).ok).toBe(true);
  });

  it("détecte une entrée réécrite", () => {
    const chain = buildChain(4);
    const target = chain.entries[2];
    if (target) target.action = "edit:autre-fichier.ts";
    const result = verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.breaks.some((brk) => brk.reason === "digest" && brk.index === 2)).toBe(true);
  });

  it("détecte une entrée retirée au milieu", () => {
    const chain = buildChain(4);
    chain.entries.splice(1, 1);
    expect(verifyChain(chain).ok).toBe(false);
  });

  it("détecte une inversion d'ordre", () => {
    const chain = buildChain(3);
    const first = chain.entries[0];
    if (first) chain.entries[0] = { ...chain.entries[2]!, index: 0 };
    expect(verifyChain(chain).ok).toBe(false);
  });

  it("donne la même empreinte de session pour deux constructions identiques", () => {
    expect(sessionDigest(buildChain(5))).toBe(sessionDigest(buildChain(5)));
    const other = buildChain(5);
    if (other.entries[0]) other.entries[0].action = "write:x";
    expect(sessionDigest(other)).not.toBe(sessionDigest(buildChain(5)));
  });

  it("canonicalise indépendamment de l'ordre des clés", () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
    expect(chainedDigest(null, { a: 1, b: 2 })).toBe(chainedDigest(null, { b: 2, a: 1 }));
  });
});
