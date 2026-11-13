# Expérience — spec contre « vibe coding »

Deux implémentations de la **même** fonction (`isIgnored(path, patterns)` : motifs
glob → décision d'exclusion), écrites par deux sous-agents du même modèle, avec
le même outillage, dans deux répertoires isolés :

| Lot | Ce que le sous-agent reçoit |
|---|---|
| `spec/` | la spécification EARS + les propriétés attendues, **avant** d'écrire |
| `vibe/` | une phrase : « écris une fonction qui teste si un chemin correspond à un motif glob » |

La mesure est objective : la **même** suite de tests (`tests/glob.test.mjs`, 14 cas)
est exécutée contre les deux implémentations. On compte :

- le nombre de tests en échec à la fin (défauts) ;
- le nombre d'itérations (appels d'outils) ;
- la durée.

Limites assumées : même modèle, même opérateur, différence unique = la présence de
la spécification. Ce n'est pas une preuve générale, c'est une mesure sur cette
fonction, avec la méthode décrite.
