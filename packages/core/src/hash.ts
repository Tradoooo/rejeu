import { createHash } from "node:crypto";

/** Tri récursif des clés : deux objets identiques sérialisent à l'identique. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = sortValue(source[key]);
    return out;
  }
  return value;
}

/** Sérialisation canonique (clés triées) — base de tous les digests. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Digest chaîné : l'entrée courante dépend de la précédente. */
export function chainedDigest(previous: string | null, payload: unknown): string {
  return sha256(`${previous ?? "GENESIS"}\n${canonical(payload)}`);
}
