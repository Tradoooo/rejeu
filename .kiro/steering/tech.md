# Steering — technique

- **Runtime** : Node ≥ 22, TypeScript exécuté directement par Node (type
  stripping) ; aucune étape de build pour la bibliothèque. Les imports
  relatifs portent l'extension `.ts` (`allowImportingTsExtensions`).
- **Dépendances** : le cœur, la CLI et le broker n'ont **aucune** dépendance
  d'exécution. Seuls les tests et le site tirent `vitest`, `fast-check`,
  `playwright`, `@axe-core/playwright`.
- **Git** : toutes les opérations passent par `git()`/`gitOrThrow()` qui
  neutralisent `GIT_DIR`, `GIT_WORK_TREE` et `GIT_INDEX_FILE` hérités.
- **Erreurs** : échec explicite plutôt que résultat partiel ; le message
  nomme la commande et la sortie d'erreur.
- **CI** : verdict en 5 minutes par job (`timeout-minutes: 5`), `concurrency`
  + `cancel-in-progress`, `fetch-depth: 1`. Le job `a11y` exige 0 violation.
