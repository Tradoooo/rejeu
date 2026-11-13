import { chainedDigest, canonical, sha256 } from "./hash.ts";
import type { Chain, ChainBreak, Checkpoint, VerifyResult } from "./types.ts";

/** Champs d'une entrée, hors digest. */
export type CheckpointFields = Omit<Checkpoint, "index" | "digest">;

/** Construit une entrée numérotée et chaînée sur la précédente. */
export function makeEntry(previous: Checkpoint | null, fields: CheckpointFields): Checkpoint {
  const index = previous ? previous.index + 1 : 0;
  const digest = chainedDigest(previous ? previous.digest : null, { index, ...fields });
  return { index, ...fields, digest };
}

/** Empreinte d'une session de capture (utilisable en CI comme identifiant). */
export function sessionDigest(chain: Chain): string {
  return sha256(canonical({ session: chain.session, entries: chain.entries }));
}

/**
 * Vérifie l'intégrité de la chaîne : digest recalculé, parent cohérent,
 * index strictement croissants. Retourne la première rupture de chaque type.
 */
export function verifyChain(chain: Chain): VerifyResult {
  const breaks: ChainBreak[] = [];
  let previous: Checkpoint | null = null;

  for (const [position, entry] of chain.entries.entries()) {
    if (entry.index !== position) {
      breaks.push({ index: position, reason: "order", expected: String(position), found: String(entry.index) });
    }
    const expectedParent = previous ? previous.tree : null;
    if (entry.parentTree !== expectedParent) {
      breaks.push({ index: position, reason: "parent", expected: String(expectedParent), found: String(entry.parentTree) });
    }
    const { digest: _digest, index: _index, ...fields } = entry;
    const expected = chainedDigest(previous ? previous.digest : null, { index: entry.index, ...fields });
    if (expected !== entry.digest) {
      breaks.push({ index: position, reason: "digest", expected, found: entry.digest });
    }
    previous = entry;
  }

  return { ok: breaks.length === 0, checked: chain.entries.length, breaks };
}
