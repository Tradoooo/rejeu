# Steering — déterminisme de la capture

Règle : **un checkpoint doit être une fonction du contenu du dépôt, jamais de
l'horloge, du hasard ou du réseau.**

## Ce qui est interdit dans un fichier versionné

- `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` écrits
  dans un fichier du dépôt (version, manifeste, cache, artefact de build).
- Toute commande de build qui écrit un horodatage dans un fichier suivi.

## Ce qu'on fait à la place

- L'horloge logique vient de `SOURCE_DATE_EPOCH` (`store.logicalNow()`).
- Un artefact généré non déterministe (VERSION, cache, `dist/`) se déclare
  dans `.replayignore` — il n'entre pas dans l'état capturé.
- `.replay/`, `.git/` et `node_modules/` sont toujours exclus, même sans
  `.replayignore` : le journal ne se capture jamais lui-même.

## Pourquoi cette règle existe

Deux captures de la même action doivent produire le même arbre (REJ-F-03).
Ce n'est pas une préférence : sans elle, la timeline affiche de faux écarts
et le verdict devient inutilisable. Le contre-exemple est documenté dans
`KIRO_JOURNAL.md` (section « property seed 20261104 ») et verrouillé par
`packages/core/test/version-property.test.ts`.

## Vérification

```bash
pnpm test:run        # REJ-P-01..05 + version-property
node scripts/check-line-limits.mjs
```
