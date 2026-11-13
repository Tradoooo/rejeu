# Résultat — spec contre « vibe coding », mesuré

Mesuré le 13 novembre 2026 par `node measure.mjs` (résultat brut : `mesure.json`).
Fonction comparée : `isIgnored(path, patterns)` — motifs glob → décision d'exclusion.

## La mesure objective

La **même** suite de 14 cas (`tests/glob.test.mjs`) est exécutée contre les deux
implémentations. C'est elle qui tranche : un défaut = un test en échec.

| Lot | Tests réussis | **Tests en échec** | Tests écrits par l'agent | Lignes d'implémentation |
|---|---|---|---|---|
| spec | 14 / 14 | **0** | 22 | 75 |
| vibe | 14 / 14 | **0** | 9 | 128 |

## Le coût déclaré par chaque sous-agent

| Lot | Échecs à la première exécution | Itérations d'outils | Durée déclarée |
|---|---|---|---|
| spec | 0 | 1 | ~3 min 30 |
| vibe | 1 (`*` ancré sur le chemin complet) | ~14 | ~7 min |

Ces trois colonnes viennent du **rapport du sous-agent** : elles sont déclaratives,
pas instrumentées. La première ligne du tableau, elle, est mesurée par le script.

## Lecture

- Les deux implémentations **passent** la suite partagée : la différence ne se lit
  pas dans le résultat final, elle se lit dans le **coût**.
- Le lot « spec » n'a pas eu à corriger son implémentation. Le lot « vibe » a dû
  corriger une anchoring faux sur `*` : la spécification EARS servait de liste de
  contrôle, et a évité d'inventer une sémantique pour `*` et `?`.
- Le lot « spec » a produit **75 lignes et 22 tests** ; le lot « vibe », **128 lignes
  et 9 tests** : moins de tests pour plus de code.

## Ce que cette mesure ne dit pas

- Qu'une spécification vaut toujours le double, ou qu'elle vaut quelque chose sur
  une fonction plus complexe : **une fonction, un modèle, une fois**.
- Le comptage des itérations n'est pas instrumenté : il est déclaratif.
- La suite partagée sert de non-régression, pas d'oracle de correction.
