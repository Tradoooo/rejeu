# Rejeu

**Rejouer les versions d'un agent, pas ses logs.**

Un agent itère jusqu'à ce que la CI passe, puis l'équipe `squash` la PR pour la
rendre propre : les états intermédiaires disparaissent et l'itération qui a
introduit le bug n'existe plus. `git bisect` ne peut rien (les commits
n'existent plus), un traceur d'agent non plus (il n'exécute aucun prédicat).

Rejeu capture un **checkpoint** après chaque appel d'outil mutant, puis
**rejoue réellement** un prédicat sur chaque état, dans un bac à sable, et
rend **l'index de la version fautive**.

```
REJEU · session a41f9c2 · 7 checkpoints · 3 rejoués
VERDICT  Itération fautive #2 — premier checkpoint où le prédicat bascule.  (arbre 8ac91e0)
TEMPS    1,1 s · hôte intact · CHAÎNE vérifiée 7/7
```

## Vidéo (69 s)

▶ [`docs/demo/rejeu-demo.mp4`](docs/demo/rejeu-demo.mp4) — H.264 1280×720, **sans
audio** (ni musique, ni narration). Les 15 premières secondes montrent le
problème **et** le chiffre. Découpage : [`docs/VIDEO.md`](docs/VIDEO.md).
**Toutes les sorties affichées sont produites par de vraies exécutions** :
`scripts/capture-reel.mjs` rejoue la session réelle de l'agent (état fautif
extrait, test exécuté, hook invoqué, recherche relancée) et le reel n'affiche
que ces sorties. La vidéo est aussi publiée avec le site :
https://tradoooo.github.io/rejeu/demo/rejeu-demo.mp4

## Démonstration (hors ligne)

Mesuré (`scripts/measure-claims.mjs`) : **0,38 s** pour voir le verdict dans la
démo, **0,77 s** pour une première valeur sur un dépôt vierge (`git init` +
`rejeu capture` + `rejeu find`). Les affirmations « moins de 30 s » et
« moins de 60 s » du README sont donc des mesures, pas des promesses.

→ **https://tradoooo.github.io/rejeu/**

La page rejoue un résultat **réellement mesuré** (sept checkpoints, arbres git
réels, prédicat exécuté pour de vrai) : elle n'exécute rien à l'écran, ne fait
aucune requête réseau, et ne peut pas échouer devant un jury.

## À qui ça sert

**Anaïs, dev senior dans une équipe de six.** Chaque semaine, trois PR sont
produites par un agent de code (CLI headless) sur deux dépôts. Elle reviews les
diff, pas les étapes. Quand la CI casse après un `squash`, elle ne sait plus
quelle version a cassé — et l'équipe perd du temps à le retrouver. C'est le
problème que Rejeu adresse : **pas de commit fautif à retrouver, parce qu'il
n'existe plus**.

## Une session réelle d'agent (pas une maquette)

Le 13 novembre 2026, `opencode` 2.1.1 (modèle `inferhub/ag/claude-sonnet-4-6`)
a reçu la tâche « renomme `parse` en `parseList` dans `src/parser.js`, sans
toucher au test ». Il a renommé → **checkpoint 0**, les tests ont cassé, il a
corrigé le test → **checkpoint 1**. `first_faulty` a répondu
**itération fautive #0** en **3,0 s**, dépôt hôte intact, chaîne vérifiée 2/2.

- rapport de la session : [`report-agent.html`](https://tradoooo.github.io/rejeu/report-agent.html)
- chaîne brute : [`fixtures/session-agent/chain.json`](fixtures/session-agent/chain.json)

Limite : la capture est **coopérative** (l'agent appelle `replay_checkpoint`
parce que le prompt le lui demande). Un proxy qui interpose les outils de
l'agent reste à faire.

## Capture non coopérative (l'agent ne sait rien)

Le mode coopératif suppose que l'agent appelle `replay_checkpoint`. Le
**proxy** supprime cette condition : il s'interpose entre l'agent et son
serveur MCP d'outils, transmet les appels inchangés, et capture l'état du
dépôt **à chaque changement**, sans que l'agent le sache.

```bash
# L'agent est configuré avec le proxy, pas avec le serveur enveloppé :
opencode mcp add fs-proxy \
  --env REJEU_PROXY_COMMAND="node examples/fs-mcp-server.mjs" \
  --env REJEU_REPO="$PWD" --env REJEU_SESSION=ma-session \
  -- node packages/proxy/src/server.ts
```

Prouvé sur un agent réel le 13 novembre 2026 : **3 appels d'outil → 2
checkpoints** — l'appel de lecture (`list_dir`) n'en produit aucun, les deux
écritures en produisent un chacune. Artefacts :
[`fixtures/session-proxy/`](fixtures/session-proxy/).

## En 60 secondes sur votre dépôt

```bash
# 1. capturer un checkpoint (autant de fois que d'appels mutants)
node packages/cli/src/index.ts capture --repo . --session demo --tool edit --action "edit:src/parser.ts"

# 2. vérifier la chaîne d'attestation
node packages/cli/src/index.ts verify --repo . --session demo

# 3. localiser l'itération fautive, par exécution réelle
node packages/cli/src/index.ts find --repo . --session demo \
  --predicate "node --test test/parser.test.js"

# 4. rapport HTML imprimable A4
node packages/cli/src/index.ts report --repo . --session demo \
  --predicate "node --test test/parser.test.js"
```

Automatiquement, c'est le **broker MCP** qui capture : il s'interpose entre
l'agent et ses outils (`replay_checkpoint`, `first_faulty`, `verify_chain`,
JSON-RPC sur stdio, zéro dépendance). L'agent n'est ni patché ni tracé.

## Ce que Rejeu fait, et ne fait pas

| Fait | Ne fait pas |
|---|---|
| rejoue les **états du dépôt** (arbres git adressés par contenu) | ne rejoue pas les appels système d'un processus (`rr`) |
| exécute le prédicat **pour de vrai** à chaque état | n'exécute rien en mode « bande » (sorties réinjectées) |
| rend **l'index** de la version fautive | ne dit pas si le correctif est bon |
| chaîne d'attestation `chain.json` vérifiable en CI | ne prouve pas l'honnêteté de l'agent qui l'a écrite |
| suspend le verdict si le prédicat est **non déterministe** | ne devine pas à la place d'un test instable |
| coupure réseau `unshare -n` (Linux) | ne supporte pas macOS/Windows en v0.1 |

## Mesures

Voir [`docs/MESURES.md`](docs/MESURES.md) — produites par
`node corpus/generate.mjs && node corpus/measure.mjs` :

- session réelle d'agent : **itération fautive localisée (#0)**, en **0,5 à 3,2 s** selon la charge (trois exécutions réelles du même prédicat sur le même état — on publie l'étendue, pas un chiffre unique)
- **20/20** localisations correctes sur le banc de 20 sessions
- **médiane 1,90 s** par session (min 0,76 s, max 4,02 s)
- **95/162** checkpoints rejoués (la dichotomie est utilisée quand le prédicat est monotone)
- **20/20** chaînes vérifiées, **20/20** dépôts hôtes intacts
- `axe` : **0 violation et 0 contrôle non concluant** sur les quatre pages (le contraste des icônes est désormais mesuré : elles sont en SVG, l'information reste portée par le texte)
- navigation clavier : **11 éléments focalisés, focus visible sur les 11** ; `prefers-reduced-motion` : transitions et animations à **0 s** — les deux mesurés par `scripts/a11y.mjs`
- thème clair et sombre : captures dans [`docs/preuves/`](docs/preuves/)

## La perte, mesurée à trois bras

Une PR squashée : l'historique d'itération disparaît, un test échoue. Des
sujets (agents, même modèle) doivent dire **quelle modification a cassé le test
et à quelle itération**. Trois bras, sur des dépôts réels à 8 modules et un diff
de ~190 lignes :

| | sans capture | manuel (chaîne + boucle écrite à la main) | rejeu |
|---|---|---|---|
| **itération correcte** | **4/5** | **9/9** | **9/9** |
| temps médian | **42 min 40 s** | **5 min 44 s** | 7 min 59 s |
| temps min / max | 19 min / 73 min | 2 min 54 s / 10 min 21 s | 5 min 14 s / 9 min 26 s |

Trois lectures, dont une qui nous coûte :

1. **Sans capture, l'information survit mais devient coûteuse** : 4 sujets sur 5
   l'ont exhumée via `git fsck` (les objets orphelins survivent à la
   suppression des refs) — en 19 à 73 minutes. Un sujet a répondu « inconnue ».
2. **La capture est ce qui rend l'itération trouvable** : chaîne présente →
   9/9, en 5 min 44 s.
3. **Notre outil n'est pas plus rapide qu'un agent qui refait la boucle**
   (7 min 59 s contre 5 min 44 s) : avec l'outil, les sujets *vérifient* le
   verdict en rejouant les arbres à la main. L'outil donne la même réponse en
   **1 commande et ~1 s** ; chez un agent, le temps est dominé par la latence
   du modèle. **L'outil supprime le travail, pas la latence.**

Et la fréquence, comptée sur les dépôts réels de l'organisation
(`scripts/measure-frequency.mjs`) : **616 PRs mergées**, dont **615 (99,8 %)
fusionnées à un seul commit** et **204 (33,1 %)** qui avaient plusieurs commits
avant fusion — donc une histoire d'itération effacée.

Détail, méthode et limites (sujets = agents, un cas invalide exclu, pilote
fuyant) : [`docs/PERTES-resultats.md`](docs/PERTES-resultats.md).

## Accessibilité

`scripts/a11y.mjs` (job CI `a11y`) mesure, sur les quatre pages publiées :

- **axe** (WCAG 2.1 AA + bonnes pratiques) : **0 violation**, **0 contrôle non concluant** ;
- **navigation clavier** : tabulation complète, focus visible (contour) sur chaque élément ;
- **`prefers-reduced-motion`** : transitions et animations désactivées ;
- **thème clair et sombre** : le rapport et la démo suivent `prefers-color-scheme`.

L'information n'est jamais portée par la seule couleur : chaque état porte une
icône **et** un texte (« passe », « échec »).

## Les agents de relecture

- **relecteur** — auditeur **en lecture seule** : il vérifie que la chaîne
  s'atteste et que chaque exigence EARS a un vérificateur nommé.
  `node tools/relecteur.mjs --repo . --session <id>` ; définition : `.kiro/agents/relecteur.md`.
- **testeur** — exécute la suite dans un bac à sable, réseau coupé quand le
  noyau l'autorise (et le dit quand il refuse), sans écrire dans le dépôt.
  `node tools/testeur.mjs` ; définition : `.kiro/agents/testeur.md`.

Le relecteur a déjà servi : il a trouvé une exigence sans vérificateur nommé
(`REJ-P-05`), qui a été corrigée et couverte par un test.

## Spec contre « vibe coding », mesuré

`experiments/spec-vibe/` : deux sous-agents du même modèle implémentent la même
fonction (`isIgnored`), l'un avec la spécification EARS, l'autre avec une seule
phrase. La **même** suite de 14 cas est ensuite exécutée contre les deux.

| Lot | Tests en échec | Tests écrits par l'agent | Lignes | Échecs à la 1ʳᵉ exécution (déclaré) |
|---|---|---|---|---|
| spec | **0** | 22 | 75 | 0 |
| vibe | **0** | 9 | 128 | 1 |

Les deux finissent correctes ; la différence est dans le **coût** (0 correction
contre 1, 75 lignes contre 128). Détail et limites : [`experiments/spec-vibe/RESULTATS.md`](experiments/spec-vibe/RESULTATS.md).

## Les jugements

Un juge indépendant (la grille seule, sans la fiche d'origine) a noté le dépôt
**60/100** puis **78/100** après les corrections — les deux verdicts, et ce qui
a été fait en réponse, sont publiés : [`docs/jugements.md`](docs/jugements.md).

## Les concurrents, honnêtement

[`docs/CONCURRENTS.md`](docs/CONCURRENTS.md) compare **20 concurrents** vérifiés
sur leur documentation et leur code source : Claude Code (checkpoints, `/rewind`),
Cursor, opencode (snapshots), Codex CLI, Aider, Cline, Roo Code, Continue,
Windsurf, `git reflog`, `git stash`, `git bisect`, `rr`, replay.io, VCR.py,
Polly, LangSmith, Langfuse, OpenTelemetry GenAI.

Trois conclusions qui nous coûtent des points, mais qu'on préfère écrire :

1. **`git bisect run` exécute un prédicat et rend l'index du commit fautif.**
   Notre différence n'est pas l'algorithme : c'est que nous indexons des **états
   non commités**, là où bisect n'a plus de commits après un squash.
2. **Les checkpoints d'agents sont plus proches de nous que nous ne l'affirmions.**
   Cline et Roo Code utilisent un dépôt git ombré, opencode une base d'objets
   séparée — et ils **survivent au squash**. Ce qui nous reste : l'exécution du
   prédicat sur chaque état, l'index de version fautive, la chaîne d'attestation.
3. **Une limite de notre stockage, trouvée et corrigée pendant ce travail** :
   nos arbres vivaient sans ref et `git gc --prune=now` les effaçait. Chaque
   checkpoint crée désormais `refs/rejeu/<session>/<index>` ; vérifié après un
   `gc --prune=now` réel.

## Architecture

```
packages/core     store de checkpoints · chaîne d'attestation · bac à sable · localisation · rapport
packages/cli      capture · ls · verify · find · report
packages/broker   serveur MCP stdio (zéro dépendance) : replay_checkpoint, first_faulty, verify_chain
packages/proxy    proxy MCP non coopératif : capture à chaque changement d'état
apps/web          démonstration hors ligne (quatre états) + rapports imprimables
scripts           fixture de démo · build du site · axe · garde-fou de structure
corpus            banc de 20 sessions (générateur + mesure)
.kiro             specs EARS, steering, hook checkpoint-guard, journal
```

Aucune dépendance d'exécution dans le cœur, la CLI et le broker : le
TypeScript est exécuté directement par Node (type stripping), imports
relatifs en `.ts`.

## Garanties testées

| Propriété | Test |
|---|---|
| capture sans toucher à l'index ni à l'arbre de travail | `store.test.ts` |
| même état ⇒ même arbre (et contre-exemple documenté) | `store.test.ts`, `version-property.test.ts` |
| chaîne : réécriture, retrait, réordonnancement détectés | `chain.test.ts`, `properties.test.ts` P-02 |
| localisation par exécution réelle | `find.test.ts` |
| dépôt hôte intact après rejeu | `find.test.ts` |
| flaky ⇒ verdict suspendu | `find.test.ts` |
| dichotomie = même index, moins d'exécutions | `find.test.ts` |
| hook `checkpoint-guard` bloque `amend`/`reset --hard` | `.kiro/hooks/checkpoint-guard.test.sh` |
| **incident réel** : un agent a tenté `git commit --amend` pendant une session capturée, le hook l'a bloqué | [`fixtures/session-hook/incident.md`](fixtures/session-hook/incident.md) |
| le proxy applique le hook (l'appel refusé n'est pas transmis) | `packages/proxy/test/proxy.test.ts › refuse un appel dont la commande est interdite, sans la transmettre` |
| bac à sable : horloge logique, HOME jetable, aucune variable GIT | `packages/core/test/sandbox.test.ts` |
| broker : trois outils, capture réelle, erreur sans mourir | `packages/broker/test/broker.test.ts` |
| 0 violation axe | `scripts/a11y.mjs` (job CI `a11y`) |
| fichiers < 500 lignes, fonctions < 50 | `scripts/check-line-limits.mjs` |

## Développement

```bash
pnpm install
pnpm -r typecheck
pnpm test:run          # REJEU_SEED=20261104
pnpm guards
pnpm build && node scripts/a11y.mjs
```

MIT.
