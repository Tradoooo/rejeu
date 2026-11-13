# Lots — rejeu (v0.1)

| Lot | Contenu | État | Preuve |
|---|---|---|---|
| L1 | Store de checkpoints (index temporaire, `git write-tree`), chargement/écriture de chaîne | **fait** | `store.test.ts` (5 tests) |
| L2 | Chaîne d'attestation : digest chaîné, `verifyChain`, détection de réécriture/retrait/ordre | **fait** | `chain.test.ts` (6 tests) |
| L3 | Bac à sable : extraction, `unshare -n`, environnement neutralisé, timeout tuable | **fait** | `sandbox.ts` ; `find.test.ts` (5 tests) |
| L4 | Localisation : linéaire, dichotomie prudente, flakies, `hostRepoUnchanged` | **fait** | `find.test.ts` |
| L5 | Propriétés fast-check REJ-P-01 → 05, `REJEU_SEED` reproductible | **fait** | `properties.test.ts` (6 tests) |
| L6 | Contre-exemple réel + correctif (`.replayignore`, `.replay/` exclu) | **fait** | `version-property.test.ts` (3 tests), journal |
| L7 | CLI `capture`/`ls`/`verify`/`find`/`report` | **fait** | exécution réelle consignée au journal |
| L8 | Broker MCP stdio zéro dépendance (3 outils) | **fait** | `packages/broker/src/server.ts`, test manuel |
| L9 | Rapport HTML autonome + 4 états + démo hors ligne | **fait** | `build-site.mjs`, `a11y.mjs` |
| L10 | Accessibilité : axe 0 violation sur les 3 pages | **fait** | job CI `a11y` |
| L11 | Corpus de banc 20 sessions, mesures réelles (temps, localisation) | **fait** | `corpus/measure.mjs`, `docs/MESURES.md` |
| L12 | Capture d'une session d'agent réelle via le broker | **à faire** | — |
| L13 | Vidéo de démonstration (< 3 min) | **à faire** | — |
