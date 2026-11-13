# Mesures — banc de 20 sessions (exécution réelle)

Mesuré le 2026-11-13T13:43:38.087Z par `node corpus/generate.mjs && node corpus/measure.mjs`.
Chaque verdict provient de l'exécution réelle du prédicat sur chaque arbre
git du corpus. Ce qui est scripté : l'injection du défaut et sa position.

| Chiffre | Valeur |
|---|---|
| Sessions | 20 |
| Localisations correctes | **20/20** (100 %) |
| Temps médian par session | **1.90 s** (min 0.76, max 4.02) |
| Checkpoints rejoués | 95/162 |
| Chaînes vérifiées | 20/20 |
| Dépôts hôtes intacts | 20/20 |

| Session | Module | Checkpoints | Vérité | Trouvé | Correct | Temps | Rejoués | Chaîne |
|---|---|---|---|---|---|---|---|---|
| bench-00 | parser | 5 | #1 | #1 | oui | 0.83 s | 2 | vérifiée |
| bench-01 | slug | 6 | #4 | #4 | oui | 1.84 s | 5 | vérifiée |
| bench-02 | range | 7 | #2 | #2 | oui | 1.42 s | 3 | vérifiée |
| bench-03 | parser | 8 | #4 | #4 | oui | 1.89 s | 5 | vérifiée |
| bench-04 | slug | 9 | #6 | #6 | oui | 2.77 s | 7 | vérifiée |
| bench-05 | range | 10 | #8 | #8 | oui | 4.02 s | 9 | vérifiée |
| bench-06 | parser | 11 | #1 | #1 | oui | 1.08 s | 2 | vérifiée |
| bench-07 | slug | 12 | #2 | #2 | oui | 1.96 s | 3 | vérifiée |
| bench-08 | range | 5 | #1 | #1 | oui | 1.91 s | 2 | vérifiée |
| bench-09 | parser | 6 | #4 | #4 | oui | 2.30 s | 5 | vérifiée |
| bench-10 | slug | 7 | #1 | #1 | oui | 1.06 s | 2 | vérifiée |
| bench-11 | range | 8 | #4 | #4 | oui | 2.12 s | 5 | vérifiée |
| bench-12 | parser | 9 | #2 | #2 | oui | 1.13 s | 3 | vérifiée |
| bench-13 | slug | 10 | #8 | #8 | oui | 1.90 s | 9 | vérifiée |
| bench-14 | range | 11 | #7 | #7 | oui | 2.31 s | 8 | vérifiée |
| bench-15 | parser | 12 | #6 | #6 | oui | 1.92 s | 7 | vérifiée |
| bench-16 | slug | 5 | #1 | #1 | oui | 0.76 s | 2 | vérifiée |
| bench-17 | range | 6 | #4 | #4 | oui | 2.01 s | 5 | vérifiée |
| bench-18 | parser | 7 | #5 | #5 | oui | 1.78 s | 6 | vérifiée |
| bench-19 | slug | 8 | #4 | #4 | oui | 1.54 s | 5 | vérifiée |

## Sessions réelles d'agents (en plus du banc)

| Session | Agent | Mode de capture | Résultat | Artefact |
|---|---|---|---|---|
| `opencode-02` | opencode 2.1.1 (`inferhub/ag/claude-sonnet-4-6`) | coopérative (l'agent appelle le checkpoint) | itération fautive **#0** en **0,6 s**, chaîne 2/2, hôte intact | `fixtures/session-agent/` |
| `proxy-agent` | opencode 2.1.1 | **non coopérative** (proxy MCP) | 3 appels d'outil → **2 checkpoints**, l'appel de lecture n'en produit aucun | `fixtures/session-proxy/` |

## Comparaison avec la recherche manuelle (session squashée)

Sur la session `opencode-02`, l'agent a produit un état rouge **intermédiaire
qui n'a jamais été committé** (la PR a été « squashée » : un seul commit reste).
Mesuré sur cette session :

| Voie | Résultat | Temps |
|---|---|---|
| Recherche manuelle dans l'historique git (`git log -S`, `git bisect`) | **aucun état intermédiaire retrouvé** : le commit fautif n'existe pas | recherche indéfinie (le commit n'existe pas) |
| `rejeu find` | itération fautive **#0** | **0,6 s** |

C'est la différence structurelle : la recherche manuelle ne peut pas trouver ce
qui n'est pas dans l'historique ; rejeu capture l'état au moment où il existe.

## Ce qui n'est pas mesuré

- La **perte subie par les équipes** (minutes perdues à retrouver une version
  fautive après un squash) : elle exige un chronométrage humain, non réalisé.
  Le protocole de mesure est écrit dans `docs/PERTES.md`.
- Le banc de 20 sessions a des **défauts injectés par script** ; les arbres,
  les exécutions et les temps, eux, sont réels.
