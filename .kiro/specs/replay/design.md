# Conception — rejeu

## Les trois objets, tenus séparés

| Objet | Représentation | Où |
|---|---|---|
| Ce qui est **rejoué** | états du dépôt : arbres git adressés par contenu | `.replay/<session>/chain.json` + base d'objets du dépôt |
| Ce qui est **prouvé** | index du premier checkpoint où le prédicat bascule, par exécution réelle | `findFaulty()` |
| Ce qui est **versionné** | chaîne d'attestation + rapport | `chain.json`, `report.html`, `session-digest.txt` |

## Flux

```
agent ──appel d'outil──▶ broker MCP ──▶ captureCheckpoint()  (arbre git + digest chaîné)
                                              │
                                              ▼
                                    .replay/<session>/chain.json
                                              │
prédicat ──────────────────────────▶ findFaulty()
                                        │  extrait l'arbre dans /tmp
                                        │  unshare -n, TZ=UTC, HOME jetable
                                        │  exécute le prédicat
                                        ▼
                             verdict : index, arbre, durée, chaîne
```

## Décisions

1. **Index temporaire.** `captureCheckpoint` écrit dans un `GIT_INDEX_FILE`
   temporaire : l'index réel et l'arbre de travail ne sont jamais touchés
   (REJ-F-02). C'est la raison pour laquelle la capture peut tourner pendant
   qu'un agent travaille.
2. **`.replay/` toujours exclu.** Le journal ne fait pas partie de l'état
   capturé. Sans cette règle, deux captures du même état produisent deux
   arbres : c'est le contre-exemple réel consigné dans `KIRO_JOURNAL.md`.
3. **Digest chaîné.** `digest = sha256(prevDigest + canonical(entrée))`.
   Réécrire une entrée casse la chaîne à cet endroit et seulement là.
4. **Bac à sable jetable.** Chaque checkpoint est extrait dans un
   `mkdtemp`, le prédicat y tourne avec `HOME`/`TMPDIR` pointant vers le
   bac à sable, les variables `GIT_*`, `GH_*`, `AWS_*` et les clés de
   fournisseurs retirées. `unshare -n` coupe le réseau quand le noyau
   l'autorise ; sinon la sortie indique `networkCut: false` au lieu de mentir.
5. **Flakies.** Un verdict localisé est rejoué deux fois. Si l'une des
   passes diffère, le verdict devient `non-deterministe` : rejeu ne devine pas.
6. **Dichotomie prudente.** La dichotomie n'est valide que si le prédicat
   reste faux après la première bascule. Si le dernier checkpoint passe, on
   retombe sur le balayage linéaire.

## Contrat du prédicat

Le prédicat est une commande shell exécutée dans le bac à sable, code de
sortie 0 = passe. Il ne doit dépendre que de l'arbre extrait et des outils
disponibles ; un prédicat qui lit hors de l'arbre échouera partout (constaté
en test manuel, consigné au journal).

## Limites assumées

- Linux uniquement pour la coupure réseau (`unshare -n`).
- Seuls les appels passés par le broker sont capturés.
- La chaîne prouve l'intégrité du journal, pas l'honnêteté de l'agent.
