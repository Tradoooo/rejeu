# Exigences — rejeu (EARS)

Chaque exigence porte l'identifiant de son **vérificateur** : le test qui
échoue si l'exigence est violée. Un lot n'est terminé que si ses
vérificateurs passent, cités par leur nom de fichier et de test.

## REJ-F — Capture

| Id | Exigence (EARS) | Vérificateur |
|---|---|---|
| REJ-F-01 | Quand un agent effectue un appel d'outil mutant, rejeu **shall** enregistrer un checkpoint contenant l'arbre git du dépôt de travail (`git write-tree`) et son prédécesseur. | `packages/core/test/store.test.ts › capture un arbre par état, sans toucher à l'index ni au statut` |
| REJ-F-02 | La capture **shall** laisser l'index et l'arbre de travail du dépôt hôte strictement inchangés (index temporaire `GIT_INDEX_FILE`). | `packages/core/test/store.test.ts › capture un arbre par état…` (comparaison `hostDigest`) |
| REJ-F-03 | Deux captures du même état **shall** produire le même arbre. | `packages/core/test/store.test.ts › écrit le même arbre pour deux captures du même état` ; contre-exemple : `version-property.test.ts` |
| REJ-F-04 | Quand un chemin correspond à `.replayignore`, rejeu **shall** l'exclure de l'arbre capturé, ainsi que `.replay/`, `.git/` et `node_modules/`. | `packages/core/test/store.test.ts › exclut les chemins de .replayignore` |
| REJ-F-05 | La chaîne **shall** être vérifiable : toute entrée réécrite, retirée ou réordonnée doit être détectée. | `packages/core/test/chain.test.ts` (4 cas) + `properties.test.ts › P-02` |

## REJ-G — Rejeu et verdict

| Id | Exigence (EARS) | Vérificateur |
|---|---|---|
| REJ-G-01 | Quand `find` est invoqué, rejeu **shall** extraire chaque checkpoint dans un répertoire jetable et y exécuter réellement le prédicat. | `packages/core/test/find.test.ts › désigne le checkpoint où le prédicat bascule, par exécution réelle` |
| REJ-G-02 | Le rejeu **shall** ne jamais écrire dans le dépôt hôte ; l'empreinte du dépôt est identique avant et après. | `find.test.ts › ne touche jamais au dépôt hôte` |
| REJ-G-03 | Quand le prédicat bascule puis ne se reproduit pas, rejeu **shall** rendre `non-deterministe` et **shall not** désigner une itération fautive. | `find.test.ts › suspend le verdict quand le prédicat est non déterministe` |
| REJ-G-04 | Quand tous les checkpoints passent, rejeu **shall** rendre `aucun`. | `find.test.ts › rend « aucun » quand tous les checkpoints passent` |
| REJ-G-05 | En mode dichotomie sur un prédicat monotone, rejeu **shall** rendre le même index qu'en balayage linéaire, en rejouant moins de checkpoints. | `find.test.ts › la dichotomie retrouve le même index et rejoue moins de checkpoints` |
| REJ-G-06 | Le bac à sable **shall** couper le réseau quand `unshare -n` est disponible, avec une horloge logique (`SOURCE_DATE_EPOCH=0`, `TZ=UTC`). | `packages/core/src/sandbox.ts` ; vérifié par `find.test.ts` (exécution sous `unshare -n` quand le noyau l'autorise) |

## REJ-R — Rapport et accessibilité

| Id | Exigence (EARS) | Vérificateur |
|---|---|---|
| REJ-R-01 | Le rapport **shall** être un fichier HTML autonome (aucune requête réseau), imprimable A4. | `scripts/build-site.mjs` puis `scripts/a11y.mjs` (serveur local, aucune ressource externe) |
| REJ-R-02 | Le rapport **shall** présenter 0 violation `axe` (WCAG 2.1 AA + bonnes pratiques). | `scripts/a11y.mjs` — job `a11y` de la CI |
| REJ-R-03 | Chaque état du rejeu **shall** être signalé par une icône **et** un texte, jamais par la couleur seule. | `packages/core/src/report.ts` (`statusMark`) ; `apps/web/app.js` (`mark`) |
| REJ-R-04 | Les quatre états de l'interface (vide, chargement, erreur, succès) **shall** être atteignables dans la démonstration hors ligne. | `scripts/a11y.mjs` parcourt les quatre états avant de mesurer |
| REJ-R-05 | La démonstration **shall** fonctionner sans réseau et sans exécution (résultats préenregistrés). | `scripts/make-demo-fixture.mjs` + `scripts/build-site.mjs` |

## REJ-S — Broker MCP

| Id | Exigence (EARS) | Vérificateur |
|---|---|---|
| REJ-S-01 | Le broker **shall** exposer `replay_checkpoint`, `first_faulty` et `verify_chain` en JSON-RPC 2.0 sur stdio, sans dépendance. | `packages/broker/src/server.ts` ; vérifié manuellement (voir `KIRO_JOURNAL.md`, entrée « broker ») |
| REJ-S-02 | Quand un outil inconnu est appelé, le broker **shall** répondre `isError: true` sans terminer le processus. | `packages/broker/src/server.ts` (bloc `catch`) |

## REJ-P — Proxy non coopératif

| Id | Exigence (EARS) | Vérificateur |
|---|---|---|
| REJ-P-01 | Quand l'agent appelle un outil d'un serveur MCP enveloppé, le proxy **shall** transmettre l'appel inchangé et **shall** exposer les mêmes outils. | `packages/proxy/test/proxy.test.ts › présente les outils du serveur enveloppé et ajoute la vérification de chaîne` |
| REJ-P-02 | Après un appel qui modifie l'état du dépôt, le proxy **shall** enregistrer un checkpoint **sans que l'agent l'ait demandé**. | `packages/proxy/test/proxy.test.ts › capture un checkpoint après un appel mutant, sans que l'agent le demande` |
| REJ-P-03 | Après un appel qui **ne** modifie pas l'état, le proxy **shall not** créer de checkpoint. | `packages/proxy/test/proxy.test.ts › ne crée pas de checkpoint quand l'état n'a pas changé` |
| REJ-P-04 | Les checkpoints capturés par le proxy **shall** être chaînés dans l'ordre des appels. | `packages/proxy/test/proxy.test.ts › chaîne les checkpoints dans l'ordre des appels` |
| REJ-P-05 | La capture par proxy **shall** produire la même chaîne vérifiable que la capture coopérative. | `fixtures/session-proxy/chain.json` (session réelle d'un agent, 13 nov. 2026 : 3 appels → 2 checkpoints) |
