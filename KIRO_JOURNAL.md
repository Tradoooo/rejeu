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

### 14:48 — la CI a trouvé un défaut que le poste cachait

Premier run GitHub : `find.test.ts` échoue **partout** (index 0, « localisé »
au lieu de « aucun »). Diagnostic par un script isolé (`core` sans vitest) :
le prédicat échouait sur **chaque** checkpoint, donc l'outil faisait
exactement ce qu'il devait — c'est la fixture qui était fausse.

Cause : un `sed`-like trop large, lancé pour passer les imports de `.js` à
`.ts`, avait réécrit **la chaîne de caractères à l'intérieur du texte de la
fixture** : le test généré importait `../src/parser.ts`, fichier inexistant
dans le dépôt capturé. Leçon : ne jamais appliquer un remplacement d'imports
sur un fichier qui contient du code en littéral ; et un prédicat qui échoue
partout est un symptôme de fixture, pas de moteur.

Deuxième correction issue du même run : la sonde `unshare -n true` peut
réussir là où l'usage réel est refusé. `sandbox.ts` relance alors **sans**
coupure réseau et rend `networkCut: false` — dégradation annoncée, jamais
silencieuse.

### 15:12 — première session RÉELLE d'un agent, capturée par le broker

`opencode` 2.1.1, modèle `inferhub/ag/claude-sonnet-4-6`, broker MCP `rejeu`
déclaré par `opencode mcp add` (fichier projet). Tâche donnée à l'agent :
renommer `parse` en `parseList` dans `src/parser.js` **sans toucher au fichier
de test**, appeler `replay_checkpoint` après chaque édition, puis
`first_faulty`.

Ce qui s'est passé, dans l'ordre, sans intervention :

1. l'agent renomme la fonction → **checkpoint 0** (`57b095fd…`) ;
2. `node --test` échoue (le test importe `parse`) ;
3. l'agent corrige le test → **checkpoint 1** (`9a812d13…`) ;
4. `first_faulty` répond : **itération fautive #0**, en **3,0 s**, dépôt hôte
   intact, chaîne vérifiée 2/2.

C'est la démonstration que la fiche ne pouvait pas fournir : la régression est
introduite par un vrai agent, puis localisée par rejeu. Artefacts :
`fixtures/session-agent/chain.json` et `report.html` publié sur le site
(`report-agent.html`).

Limite, écrite : la capture est **coopérative** — l'agent appelle
`replay_checkpoint` parce que le prompt le lui demande. Un vrai proxy d'outils
(qui capture sans coopération) reste à faire.

### 16:10 — la vidéo, construite à partir d'exécutions réelles

Plutôt qu'un storyboard (celui de la fiche n'a jamais été tourné), la vidéo est
**enregistrée** : `scripts/capture-reel.mjs` rejoue la session réelle de
l'agent dans un dépôt temporaire (état fautif extrait comme rejeu le fait,
test exécuté, diff réel, hook invoqué, `rejeu find` relancé) et écrit
`fixtures/reel.json` ; `apps/web/reel.html` joue ces sorties scène par scène ;
`scripts/record-demo.mjs` enregistre avec Playwright et convertit en MP4
H.264 1280×720 (`docs/demo/rejeu-demo.mp4`, 59 s, 1,3 Mo, sans narration).

Trois défauts vus **au rendu réel** (cadres extraits du MP4) et corrigés :

1. le diff montrait `.replay/opencode-01/chain.json` — le journal avait été
   committé par erreur dans le dépôt du banc ; le diff est désormais limité à
   `src`, `test`, `package.json` ;
2. la sortie du test rouge était noyée dans la pile d'erreurs : elle est
   maintenant tronquée (début + fin) ;
3. le compteur « 1,9 s » perdait son zéro : format fixe à deux décimales.

Piège d'outillage : `record-demo.mjs` ré-encode **la première** vidéo
alphabétiquement trouvée dans `docs/demo/raw/` — donc l'ancienne, pas la
nouvelle. Le répertoire de travail est maintenant vidé avant chaque prise.

### 16:25 — le proxy non coopératif, prouvé sur un agent qui n'en sait rien

`packages/proxy/src/server.ts` : un serveur MCP qui **enveloppe** un autre
serveur MCP (le « serveur enveloppé »), lui transmet les appels inchangés,
et capture l'état du dépôt après chaque appel — **si et seulement s'il a
changé** (`captureCheckpointIfChanged`).

Configuration réelle, sur un agent `opencode` 2.1.1, avec un serveur de
fichiers minimal (`examples/fs-mcp-server.mjs`) :

```
opencode mcp add fs-proxy \
  --env REJEU_PROXY_COMMAND="node examples/fs-mcp-server.mjs" \
  --env REJEU_REPO=/tmp/rejeu-proxy-real --env REJEU_SESSION=proxy-agent \
  -- node packages/proxy/src/server.ts
```

Consigne donnée à l'agent : « utilise uniquement le serveur MCP fs-proxy ».
**Rien sur rejeu, rien sur les checkpoints.** Résultat : 3 appels
(`write_file`, `list_dir`, `write_file`) → **2 checkpoints** ; l'appel de
lecture n'en produit aucun. La chaîne est dans `fixtures/session-proxy/`.

Quatre tests couvrent le proxy (outils transmis, capture après appel mutant,
absence de capture sans changement, ordre des checkpoints).

Corollaire : le `reel` a été réenregistré — il disait encore « la capture est
coopérative », ce qui n'était plus vrai. La scène 9 montre maintenant la
preuve du proxy.

## Ce qui n'est pas encore fait

- La capture sans coopération passe par un serveur MCP **enveloppé** : un agent
  qui n'utilise aucun serveur MCP n'est pas capturé.
- **Comparaison spec / vibe coding** : non mesurée. La fiche V2 annonçait
  « 3 h 20 / 14 allers-retours / 3 défauts contre 1 h 05 / 27 allers-retours
  / 6 défauts » ; ces chiffres n'ont pas été produits ici et ne sont pas
  repris.
