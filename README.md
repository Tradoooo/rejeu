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

## Démonstration (hors ligne, 30 s)

→ **https://tradoooo.github.io/rejeu/**

La page rejoue un résultat **réellement mesuré** (sept checkpoints, arbres git
réels, prédicat exécuté pour de vrai) : elle n'exécute rien à l'écran, ne fait
aucune requête réseau, et ne peut pas échouer devant un jury.

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

- **20/20** localisations correctes sur le banc de 20 sessions
- **médiane 1,90 s** par session (min 0,74 s, max 3,30 s)
- **95/162** checkpoints rejoués (la dichotomie est utilisée quand le prédicat est monotone)
- **20/20** chaînes vérifiées, **20/20** dépôts hôtes intacts
- `axe` : **0 violation** sur les trois pages ; un contrôle de contraste reste non concluant (`color-mix`)

Ce qui est scripté dans le banc : l'injection du défaut et sa position. Ce qui
est réel : les arbres git, les exécutions, les temps. La capture d'une session
d'agent réelle et la vidéo ne sont **pas** faites — c'est écrit dans
[`KIRO_JOURNAL.md`](KIRO_JOURNAL.md).

## Architecture

```
packages/core     store de checkpoints · chaîne d'attestation · bac à sable · localisation · rapport
packages/cli      capture · ls · verify · find · report
packages/broker   serveur MCP stdio (zéro dépendance) : replay_checkpoint, first_faulty, verify_chain
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
