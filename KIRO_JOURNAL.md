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
*(Corrigé à 17:10 : les icônes sont passées en SVG, le contraste conclut ; le
journal de 14:55 conservait l'état de l'heure — voir l'entrée de 17:10.)*

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
H.264 1280×720 (`docs/demo/rejeu-demo.mp4` ; **69 s / 1,6 Mo après les
réenregistrements de 16:10 et 17:05**, 59 s / 1,3 Mo à cette heure-là).

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

### 16:52 — un **incident réel** : le hook a bloqué une commande d'agent

Le hook `checkpoint-guard` n'était prouvé que par un script de test. Il est
désormais **appliqué par le proxy** (`REJEU_HOOK`) : avant de transmettre un
appel au serveur enveloppé, le proxy fait passer la commande par le hook ; si le
hook refuse (code 2), l'appel **n'est pas transmis** et l'agent reçoit l'erreur.

Session réelle (`hook-incident`, opencode 2.1.1) : l'agent écrit `notes.txt`
(checkpoint #0 capturé), exécute `git add -A` (autorisé, aucun checkpoint : rien
n'a changé), puis tente `git commit --amend --no-edit` → **refusé** :

```
checkpoint-guard : « git commit --amend --no-edit » réécrit l'historique d'une session capturée.
Un checkpoint déjà écrit ne doit pas être invalidé : utilisez un commit de correction.
```

La commande n'a jamais atteint `git`. Transcription et chaîne :
`fixtures/session-hook/`.

### 16:55 — le relecteur trouve un vrai défaut dans nos propres specs

`tools/relecteur.mjs` (lecture seule) audite la chaîne **et** la correspondance
exigence ↔ vérificateur. Premier passage : `REJ-P-05 sans vérificateur nommé` —
exactement le genre de case que la grille reproche aux autres. Comblé par un
vrai test (`packages/proxy/test/proxy.test.ts › la chaîne capturée par le proxy
est vérifiable`). Le relecteur passe ensuite au vert.

Deux autres exigences sans test ont été comblées de la même façon :
`REJ-S-01` (broker → `packages/broker/test/broker.test.ts`) et `REJ-G-06`
(bac à sable → `packages/core/test/sandbox.test.ts`). Total : **38 tests**
(*à cette heure-là ; voir le décompte final dans l'entrée de 17:25*).

### 16:58 — la comparaison spec / vibe coding, mesurée

`experiments/spec-vibe/` : deux sous-agents du même modèle, la même fonction
(`isIgnored`), l'un avec la spécification EARS, l'autre avec une phrase. Mesure
objective : **la même** suite de 14 cas contre les deux implémentations.

| Lot | Tests en échec | Tests écrits par l'agent | Lignes | Échecs à la 1ʳᵉ exécution (déclaré) |
|---|---|---|---|---|
| spec | 0 | 22 | 75 | 0 |
| vibe | 0 | 9 | 128 | 1 |

Les deux finissent correctes ; la différence est dans le coût. Limites (une
fonction, un modèle, une fois ; itérations déclaratives) : `RESULTATS.md`.

### 17:05 — un défaut trouvé par la comparaison des concurrents, puis corrigé

La revue des concurrents (20 outils, sources citées) a fait tomber une limite
que nous ne soupçonnions pas : **nos arbres de checkpoint vivaient dans la base
d'objets sans ref** ; `git gc --prune=now` les effaçait. La session d'agent
capturée devenait alors **irrejouable**.

Correctif : chaque capture crée une ref `refs/rejeu/<session>/<index>`
(`protectTree` dans `store.ts`), donc l'arbre reste atteignable. Vérifié pour de
vrai : capture → `git gc --prune=now` → `git cat-file -t <arbre>` répond
`t`et `rejeu verify` répond « chaîne vérifiée ». Test ajouté (39 tests à
cette heure-là ; **40** au total à 17:25, propriété REJ-P-06 comprise).

Le même travail a faitmoving deux affirmations de notre communication, qu'on
corrige plutôt que de les défendre : `git bisect run` exécute bien un prédicat
et rend bien l'index du commit fautif (notre différence est l'indexation
d'états **non commités**), et les checkpoints d'agents (Cline, Roo Code, opencode)
sont plus proches de nous que nous ne l'affirmions et survivent au squash.

## 17:25 — les chiffres du dépôt, en un seul endroit

Un juge à froid (78/100) a relevé que les chiffres divergeaient d'un fichier à
l'autre. Voici **la seule source** ; toute contradiction avec une entrée
antérieure est une entrée datée, pas l'état actuel.

| Fait | Valeur | Où c'est produit |
|---|---|---|
| tests automatisés | **40** | `pnpm test:run` |
| pages publiées vérifiées | **4** (accueil, rapport, rapport « non déterministe », rapport de session réelle) | `scripts/a11y.mjs` |
| violations axe | **0**, et **0** contrôle non concluant | `scripts/a11y.mjs` |
| navigation clavier | 11 éléments focalisés, focus visible sur les 11 | `scripts/a11y.mjs` |
| `prefers-reduced-motion` | transitions et animations à 0 s | `scripts/a11y.mjs` |
| vidéo | **69 s**, H.264 1280×720, **1,6 Mo**, sans audio | `docs/demo/rejeu-demo.mp4` |
| démo en ligne : verdict affiché | **0,38 s** | `scripts/measure-claims.mjs` |
| première valeur sur un dépôt vierge | **0,77 s** | `scripts/measure-claims.mjs` |
| banc de 20 sessions | **20/20** correctes, médiane **1,90 s** (min 0,76 / max 4,02), 95/162 checkpoints rejoués | `corpus/measure.mjs` |
| session réelle d'agent | itération fautive **#0**, en **0,5 à 3,2 s** selon la charge (trois exécutions réelles du même prédicat sur le même état : on publie l'étendue) | `fixtures/session-agent/` |
| session squashée | recherche manuelle : **0** état retrouvé ; rejeu : **#0** | `docs/MESURES.md` |
| capture non coopérative | 3 appels d'agent → **2 checkpoints** | `fixtures/session-proxy/` |
| incident du hook | **1** commande destructive refusée (agent réel, 13 nov. 16:52) | `fixtures/session-hook/incident.md` |
| contre-exemple de propriété | **1** propriété fast-check qui échoue sur le code d'avant le correctif (graine 20261104) | `docs/preuves/propriete-contre-exemple.txt` |
| effet du steering | **6 faux écarts → 0** sur 7 captures | `docs/preuves/steering.json` |
| concurrents comparés | **20**, sourcés | `docs/CONCURRENTS.md` |

## Ce qui n'est pas encore fait

- La capture sans coopération passe par un serveur MCP **enveloppé** : un agent
  qui n'utilise aucun serveur MCP n'est pas capturé.
- La **perte subie** par les équipes n'est pas chiffrée : le protocole est
  écrit (`docs/PERTES.md`), il n'est pas exécuté (il faut des chronométrages
  humains).
- La comparaison spec / vibe coding porte sur **une fonction, un modèle, une
  fois** ; durée et itérations sont déclaratives.
- La vidéo montre les **sorties réelles rejouées** par l'outil, pas l'agent
  lui-même à l'écran.
- `chain.json` reste dans `.replay/` (ignoré par git) : `rejeu export` le copie
  vers `replay/<session>/` pour le versionner, mais ce n'est pas fait par défaut.
- La fiche V2 annonçait « 3 h 20 / 14 allers-retours / 3 défauts contre 1 h 05
  / 27 allers-retours / 6 défauts » : ces chiffres-là **ne sont pas repris**,
  la mesure produite est différente et documentée.
