# Journal de construction — rejeu

Journal horodaté, sans reconstruction : ce qui a été fait, ce qui a cassé, et
la correction. Les entrées du 13 novembre 2026 sont les événements réels de la
journée de construction.

## Ce qui était une fiche, et ce qui est devenu du code

La fiche V2-05 « Rejeu » (12 nov.) décrivait le produit et annonçait 18
chiffres. Aucun n'était produit. Ce dépôt existe pour que chaque chiffre
publié ait une commande derrière lui. Les chiffres de `docs/MESURES.md` sont
mesurés ; ceux qui ne le sont pas sont listés comme tels dans la dernière
section.

## 13 novembre 2026

### 14:12 — disque plein, 0 octet libre

`pnpm install` échoue sur `ENOSPC`. Cause : la corbeille contenait **19 Go**
de workspaces de runners GitHub Actions déjà jetés. Récupérés par suppression
de `~/.local/share/Trash/expunged/*` (fichiers déjà supprimés, aucun travail
vivant). Leçon : un `ENOSPC` se diagnostique avant de conclure à une
dépendance cassée — le message d'erreur parlait d'un shim esbuild.

### 14:22 — contre-exemple réel : la capture se capturait elle-même

**Propriété visée (REJ-F-03)** : deux captures du même état donnent le même
arbre. **Résultat** : elle était fausse dans le code, pas dans le papier.

`captureCheckpoint` faisait `git add -A` avec un index temporaire **sans
exclure `.replay/`**. Or capturer écrit `.replay/<session>/chain.json` : la
deuxième capture embarquait le journal de la première, donc un arbre
différent. La timeline aurait affiché un faux écart sur *chaque* capture.

Détection : `packages/core/test/store.test.ts › écrit le même arbre pour deux
captures du même état` — rouge au premier passage.
Correctif : `ALWAYS_IGNORED = [".replay/", ".git/", "node_modules/"]` dans
`store.ts`, appliqué à toute capture même sans `.replayignore`.

Deuxième chemin du même défaut, reproduit et verrouillé dans
`packages/core/test/version-property.test.ts` : un `scripts/version.mjs` qui
écrit `Date.now()` dans un fichier suivi rend deux captures de la **même
action** différentes. Correctif : `.replayignore` + steering
`.kiro/steering/determinism.md`.

Graine d'exécution des propriétés : **20261104** (`REJEU_SEED`, épinglée en
CI). Le défaut ne dépend pas de la graine : il est déterministe ; la graine
sert à rendre le contre-exemple rejouable à l'identique.

### 14:26 — le glob `.replayignore` ne matchait pas un répertoire

Motif `dist/` compilé en `^dist/(/.*)?$` : `dist/bundle.js` n'était pas
exclu. Détecté par `store.test.ts › exclut les chemins de .replayignore`.
Correctif : un motif terminé par `/` est traité comme préfixe.

### 14:27 — la dichotomie était inversée

`find.ts` testait `P(0)` avant `P(n−1)` et retournait `null` dès que le
premier checkpoint passait — c'est-à-dire dans le cas normal. Détecté par
`find.test.ts › la dichotomie retrouve le même index et rejoue moins de
checkpoints`. Correctif : vérifier d'abord la fin de chaîne ; si le dernier
checkpoint passe, retomber sur le balayage linéaire. Mesure sur 24
checkpoints, bascule au 17e : linéaire 18 exécutions, dichotomie 6.

### 14:33 — Node ne résout pas `./x.js` vers `x.ts`

Le type-stripping de Node exécute le TypeScript sans build, mais ne réécrit
pas les extensions. Les imports portent désormais `.ts`
(`allowImportingTsExtensions: true`). Le cœur, la CLI et le broker n'ont
**aucune** dépendance d'exécution : c'est ce qui permet `node
packages/cli/src/index.ts` sans étape de compilation.

### 14:40 — hook `checkpoint-guard` : éprouvé, pas raconté

`.kiro/hooks/checkpoint-guard.test.sh` exécute le hook sur six entrées
réelles : `git commit --amend`, `git reset --hard`, `git checkout -- .` sont
bloqués (code 2) ; un commit normal, un test et un appel sans commande
passent (code 0). La CI exécute ce script : le hook ne peut pas pourrir sans
que la CI le dise.

### 14:50 — mesures du banc de 20 sessions

`node corpus/generate.mjs && node corpus/measure.mjs` : **20/20**
localisations correctes, médiane **1,90 s** par session, 95 checkpoints
rejoués sur 162, chaînes vérifiées 20/20, dépôts hôtes intacts 20/20.
Ce qui est scripté : l'injection du défaut et sa position. Ce qui est réel :
les arbres git, les exécutions du prédicat, les temps.

### 14:55 — axe : 0 violation, et un point non concluant

`node scripts/a11y.mjs` sur les trois pages (accueil avec ses quatre états,
rapport, rapport « non déterministe ») : **0 violation**, 36 et 29 règles
passées. Une règle de contraste reste *non concluante* sur les rapports :
`axe` ne sait pas résoudre `color-mix()` ; c'est écrit ici plutôt que
présenté comme un sans-faute.

## Ce qui n'est pas encore fait

- **Capture d'une session d'agent réelle** (CLI headless + broker MCP) : le
  broker expose les trois outils et le format est testé manuellement, mais la
  session réelle n'a pas été capturée. Tant que ce n'est pas fait, les 20
  sessions du banc sont des sessions **scriptées** (arbres et exécutions
  réels).
- **Vidéo** : aucun plan tourné.
- **Comparaison spec / vibe coding** : non mesurée. La fiche V2 annonçait
  « 3 h 20 / 14 allers-retours / 3 défauts contre 1 h 05 / 27 allers-retours
  / 6 défauts » ; ces chiffres n'ont pas été produits ici et ne sont pas
  repris.
