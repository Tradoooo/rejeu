/** Un checkpoint : un état du dépôt, adressé par contenu (arbre git). */
export interface Checkpoint {
  /** Position dans la chaîne, à partir de 0. */
  index: number;
  /** Hash de l'arbre git (`git write-tree`) représentant le dépôt à cet instant. */
  tree: string;
  /** Arbre du checkpoint précédent, `null` pour le premier. */
  parentTree: string | null;
  /** Outil qui a produit l'état (`edit`, `write`, `bash`, `commit`…). */
  tool: string;
  /** Action lisible, par exemple `edit:src/parser.ts`. */
  action: string;
  /** Horodatage logique (SOURCE_DATE_EPOCH), jamais une horloge murale libre. */
  at: string;
  /** Empreinte des fichiers hors dépôt connus (hors périmètre v1 : objet vide). */
  outside: Record<string, string>;
  /** Digest de l'entrée, chaîné sur le digest précédent. */
  digest: string;
}

/** La chaîne d'attestation d'une session de capture. */
export interface Chain {
  session: string;
  repo: string;
  createdAt: string;
  entries: Checkpoint[];
}

export interface ChainBreak {
  index: number;
  reason: "digest" | "parent" | "order";
  expected: string;
  found: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  breaks: ChainBreak[];
}

/** Résultat de l'exécution d'un prédicat sur un état du dépôt. */
export interface RunResult {
  ok: boolean;
  code: number | null;
  ms: number;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  networkCut: boolean;
  sandbox: string;
}

export type VerdictStatus = "localise" | "aucun" | "non-deterministe" | "erreur";

export interface FaultVerdict {
  status: VerdictStatus;
  /** Index du premier checkpoint où le prédicat bascule (si localisé). */
  faultyIndex: number | null;
  faultyTree: string | null;
  predecessorIndex: number | null;
  predicate: string;
  mode: "lineaire" | "dichotomie";
  durationMs: number;
  checkpointsTotal: number;
  checkpointsRun: number;
  hostRepoUnchanged: boolean;
  results: Array<{ index: number; ok: boolean; ms: number; note?: string }>;
  message: string;
}
