import { hostDigest } from "./store.ts";
import { runAtCheckpoint, type PredicateOptions } from "./sandbox.ts";
import type { Chain, FaultVerdict } from "./types.ts";

export interface FindOptions extends PredicateOptions {
  mode?: "lineaire" | "dichotomie" | "auto";
  /** Nombre de passes de confirmation sur le checkpoint désigné (flakies). */
  confirmations?: number;
}

interface Memo {
  runs: number;
  results: Map<number, boolean>;
}

async function evaluate(
  repo: string,
  chain: Chain,
  index: number,
  options: FindOptions,
  memo: Memo,
): Promise<boolean> {
  const known = memo.results.get(index);
  if (known !== undefined) return known;
  const checkpoint = chain.entries[index];
  if (!checkpoint) throw new Error(`checkpoint ${index} hors chaîne`);
  const result = await runAtCheckpoint(repo, checkpoint, options);
  memo.runs += 1;
  memo.results.set(index, result.ok);
  return result.ok;
}

/** Cherche le premier k tel que P(k) échoue et P(k-1) réussit (balayage linéaire). */
async function linear(
  repo: string,
  chain: Chain,
  options: FindOptions,
  memo: Memo,
): Promise<number | null> {
  for (let index = 0; index < chain.entries.length; index += 1) {
    const ok = await evaluate(repo, chain, index, options, memo);
    if (!ok) return index;
  }
  return null;
}

/** Dichotomie : n'est valide que si le prédicat reste faux après la première bascule. */
async function bisect(
  repo: string,
  chain: Chain,
  options: FindOptions,
  memo: Memo,
): Promise<number | null> {
  const last = chain.entries.length - 1;
  const lastOk = await evaluate(repo, chain, last, options, memo);
  if (lastOk) return linear(repo, chain, options, memo);
  const firstOk = await evaluate(repo, chain, 0, options, memo);
  if (!firstOk) return 0;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    const ok = await evaluate(repo, chain, middle, options, memo);
    if (ok) low = middle;
    else high = middle;
  }
  return high;
}

/** Confirme un verdict localisé : une bascule qui ne se reproduit pas est un flaky. */
async function confirm(
  repo: string,
  chain: Chain,
  index: number,
  options: FindOptions,
): Promise<boolean> {
  const passes = options.confirmations ?? 2;
  for (let pass = 0; pass < passes; pass += 1) {
    const checkpoint = chain.entries[index];
    if (!checkpoint) return false;
    const result = await runAtCheckpoint(repo, checkpoint, options);
    if (result.ok) return false;
  }
  return true;
}

/** Localise le premier checkpoint où le prédicat bascule, sans toucher au dépôt hôte. */
export async function findFaulty(repo: string, chain: Chain, options: FindOptions): Promise<FaultVerdict> {
  const started = Date.now();
  const before = hostDigest(repo);
  const memo: Memo = { runs: 0, results: new Map() };
  const mode = options.mode === "dichotomie" ? "dichotomie" : options.mode === "auto" ? "auto" : "lineaire";
  const index = mode === "lineaire" ? await linear(repo, chain, options, memo) : await bisect(repo, chain, options, memo);
  const unchanged = hostDigest(repo) === before;
  const results = [...memo.results.entries()].map(([position, ok]) => ({ index: position, ok, ms: 0 }));

  if (index === null) {
    return verdict("aucun", null, options, Date.now() - started, chain, memo, results, unchanged,
      "Aucun checkpoint ne fait échouer le prédicat : rien à attribuer.");
  }

  const stable = await confirm(repo, chain, index, options);
  if (!stable) {
    return verdict("non-deterministe", index, options, Date.now() - started, chain, memo, results, unchanged,
      `Le prédicat échoue au checkpoint ${index} sans se reproduire : test non déterministe, verdict suspendu.`);
  }

  return verdict("localise", index, options, Date.now() - started, chain, memo, results, unchanged,
    `Itération fautive #${index} — premier checkpoint où le prédicat bascule.`);
}

function verdict(
  status: FaultVerdict["status"],
  index: number | null,
  options: FindOptions,
  durationMs: number,
  chain: Chain,
  memo: Memo,
  results: FaultVerdict["results"],
  hostRepoUnchanged: boolean,
  message: string,
): FaultVerdict {
  const checkpoint = index === null ? null : chain.entries[index];
  const predecessor = index === null || index === 0 ? null : chain.entries[index - 1];
  return {
    status,
    faultyIndex: status === "localise" || status === "non-deterministe" ? index : null,
    faultyTree: status === "localise" && checkpoint ? checkpoint.tree : null,
    predecessorIndex: status === "localise" && predecessor ? predecessor.index : null,
    predicate: options.predicate,
    mode: options.mode === "dichotomie" ? "dichotomie" : "lineaire",
    durationMs,
    checkpointsTotal: chain.entries.length,
    checkpointsRun: memo.runs,
    hostRepoUnchanged,
    results,
    message,
  };
}
