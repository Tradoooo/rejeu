# Concurrents de Rejeu — comparaison vérifiable

Vérifié le **13 novembre 2026**, sur documentation officielle et code source
(liste des sources en fin de document). Chaque affirmation sur un outil tiers
renvoie à une URL réellement consultée. Ce qui n'a pas pu être vérifié est
écrit « non vérifié ».

Rejeu, en une phrase : il **capture un état du dépôt** (arbre git adressé par
contenu) après chaque appel d'outil mutant, **exécute réellement un prédicat**
sur chaque état capturé, et rend **l'index de la version fautive**, avec une
chaîne d'attestation à digest chaîné (`chain.json`, `rejeu verify`).

---

## 1. Tableau comparatif

| Concurrent | Ce qu'il conserve | Ce qu'il exige | Exécute-t-il un prédicat ? | Donne-t-il un index de version fautive ? | Chaîne d'attestation vérifiable ? | Survit à `git commit --amend` / `--squash` ? |
|---|---|---|---|---|---|---|
| **Rejeu** (référence) | États du dépôt : arbres git adressés par contenu, hors index et hors arbre de travail | Un dépôt git ; un prédicat (shell) ; un agent instrumenté (broker ou proxy MCP) | **Oui** — le prédicat est exécuté dans un bac à sable jetable (`unshare -n` si le noyau l'accepte) | **Oui** — l'index du checkpoint fautif | **Oui** — `chain.json`, digests chaînés, `rejeu verify` | **Oui** (objets adressés par contenu, protégés par une ref `refs/rejeu/<session>/<index>` — vérifié après `git gc --prune=now`) |
| **Claude Code** (checkpoints / `/rewind`) | Instantanés de fichiers, 100 plus récents checkpoints, dans `~/.claude/file-history/<session>/` | Un prompt qui démarre un tour ; les fichiers sont capturés **avant** le prompt, pas après chaque outil | Non — la restauration ne lance rien | Non | Non (pas de liaison entre checkpoints) | **Oui** — hors git, hors du dépôt ; mais purgé après ~30 jours par défaut, et les fichiers modifiés par Bash seul ne sont pas suivis |
| **Cursor** (checkpoints) | État des fichiers modifiés, avant les changements significatifs ; stockage local **séparé de git** | Session Agent ; la restauration ne touche pas aux messages | Non | Non | Non | **Oui** — hors de l'historique git du projet |
| **opencode** (snapshots) | États de fichiers, dans une **base d'objets git interne** séparée ; scope = répertoire actif du worktree | Un dépôt git ; ≤ 2 Mio par fichier non suivi ; fichiers ignorés exclus | Non | Non | Non (commits ombrés, pas de chaîne d'attestation) | **Oui** — dépôt git séparé, l'historique du projet peut être réécrit |
| **Codex CLI** | Rien de natif : la doc recommande « Create Git checkpoints before and after a task » ; `thread/revert` ne touche que l'historique de conversation (« doesn't change local files ») | Des commits git **créés à la main** par l'utilisateur | Non | Non | Non | **Non** si les commits manuels sont amendés ou squashés |
| **Aider** | Un commit par édition, dans l'historique git du projet ; `/undo` annule le dernier commit aider ; `--auto-test` + `--test-cmd` relancent la suite après chaque édition | Un dépôt git (désactivable : `--no-git`) | **Partiellement** — `--auto-test` relance le test sur l'état **courant**, il ne rejoue pas un état antérieur | **Non** — l'échec est signalé, l'agent répare ; aucun index n'est produit | Non (commits git ordinaires) | **Non** — les commits d'aider disparaissent au squash |
| **Cline** (checkpoints) | **Dépôt git ombré** : un commit après chaque usage d'outil, y compris les fichiers non suivis par git | Git installé ;-activated par défaut | Non | Non | Non — le dépôt ombré est vérifiable par `git fsck` (intégrité des objets), mais il n'existe ni liaison entre checkpoints ni attestation du prédicat | **Oui** — dépôt ombré hors du dépôt principal |
| **Roo Code** (checkpoints) | **Dépôt git ombré** : commits au démarrage de tâche et **avant** modification de fichier (pas avant exécution de commande) | Git installé ; timeout d'init configurable (10–60 s) | Non | Non | Non | **Oui** — dépôt ombré hors du dépôt principal |
| **Continue** | **Non documenté** dans `docs.continue.dev`. Le CLI appelle `git-ai checkpoint` avant/après édition (source) ; git-ai sert à l'**attribution** (notes git), pas au rejeu | — | Non | Non | Non | Non applicable (git-ai déplace les attributions au squash ; ce n'est pas un rejeu d'état) |
| **Windsurf / Cascade** (checkpoints nommés, reverts) | État du projet ; revert vers un point de la conversation ; snapshots nommés | Cascade est **legacy** (Devin Desktop) ; les reverts sont **irréversibles** | Non | Non | Non | Non documenté |
| **`git reflog`** | Positions successives des refs (`HEAD@{2}`, `master@{one.week.ago}`) | Un dépôt git local | Non | Non | Non | **Partiellement** — l'ancien commit reste dans le reflog local (90 j par défaut), mais pas dans l'historique rewrit |
| **`git stash`** | Modifications locales, dans `refs/stash` | Une action manuelle (`git stash push`) | Non | Non | Non | **Oui** — `refs/stash` est indépendante de l'historique de branche |
| **`git bisect`** | Les commits qui existent encore dans l'historique | Un commit « bon » et un commit « mauvais » **présents dans l'historique** | **Oui** — `git bisect run <cmd>` exécute une commande (mesuré) | **Oui** — il rend le commit fautif | Non | **Non** — après un squash, les commits intermédiaires n'existent plus : le bisect ne trouve plus rien (mesuré) |
| **`rr`** | Trace **système** : appels système, threads, processus entiers ; exécution inverse sous gdb | Linux (>= 4.7), CPU Intel Nehalem+ / AMD Zen+ / AArch64 | Non — il rejoue **la même** exécution, il n'en teste pas une nouvelle | Non | Non | Sans objet (hors git) |
| **replay.io** (Replay QA) | Enregistrement déterministe du runtime navigateur (DOM, réseau, JS) ; « time-travel » dans l'enregistrement | Une application web accessible par URL | Non | Non | Non | Sans objet |
| **VCR.py** | Cassettes YAML : requêtes/réponses HTTP enregistrées | Une bibliothèque HTTP supportée | Non — les requêtes sont **réinjectées**, pas rejouées | Non | Non | Sans objet |
| **Polly** (v8) | Rien d'un état de dépôt : stratégies de résilience (Retry, Circuit Breaker, Hedging, Timeout, Rate Limiter, Fallback) | Un projet .NET | Non | Non | Non | Sans objet |
| **LangSmith** | Traces : ce qu'un agent a fait, prompts, sorties, tokens, latences ; *evaluations* sur jeux de données | Un SDK d'instrumentation et un compte | Non — les évaluateurs tournent sur des traces/datasets, pas sur des états de dépôt | Non | Non | Sans objet |
| **Langfuse** | Traces applicatives : prompts, réponses, tokens, latence, étapes d'outils | SDK + instance | Non | Non | Non | Sans objet |
| **OpenTelemetry GenAI** | **Conventions** sémantiques (spans, events, metrics) pour GenAI, MCP, agents — de la télémétrie, pas d'état | Un collecteur OTel | Non | Non | Non | Sans objet |

---

## 2. Les concurrents, par famille

### 2.1 Checkpoint / rollback / undo des agents de code

- **Claude Code** — https://code.claude.com/docs/en/checkpointing — un checkpoint
  par prompt qui démarre un tour ; 100 snapshots conservés ; `/rewind` restaure
  code et/ou conversation. Les instantanés vivent dans
  `~/.claude/file-history/<session>/`
  (https://code.claude.com/docs/en/claude-directory.md) et sont purgés après
  ~30 jours par défaut. Limites documentées : modifications Bash non suivies,
  éditions de sous-agent non restaurées, chemins liés non restaurés.
- **Cursor** — https://cursor.com/docs/agent/overview.md#checkpoints — checkpoints
  créés automatiquement avant les changements significatifs, stockage local
  séparé de git ; la restauration ne supprime pas les messages.
- **opencode** — https://opencode.ai/docs/snapshots/ — un instantané avant chaque
  étape de modèle et un à la fin de l'étape ; base d'objets git interne
  séparée ; scope limité au répertoire actif ; la doc dit explicitement
  « snapshots are a convenience, not a transaction or backup ».
- **Codex CLI** — https://learn.chatgpt.com/docs/codex/cli.md et
  https://learn.chatgpt.com/docs/app-server.md — aucun mécanisme natif de
  checkpoint de fichiers trouvé ; la doc demande des commits git manuels ;
  `thread/revert` « doesn't change local files ».
- **Aider** — https://aider.chat/docs/git.html et
  https://aider.chat/docs/usage/lint-test.html — commit automatique par édition,
  `/undo`, et `--auto-test` qui **relance la suite de tests après chaque
  édition**.
- **Cline** — https://docs.cline.bot/core-workflows/checkpoints — dépôt git
  ombré, un commit après chaque usage d'outil, fichiers non suivis inclus.
- **Roo Code** — https://roocodeinc.github.io/Roo-Code/features/checkpoints/ —
  dépôt git ombré, checkpoints avant modification de fichier (pas avant
  commande).
- **Continue** — https://docs.continue.dev/ : rien sur les checkpoints. Le CLI
  appelle `git-ai checkpoint` (source : `extensions/cli/src/services/GitAiIntegrationService.ts`
  de https://github.com/continuedev/continue) ; git-ai fait de l'attribution
  (https://github.com/git-ai-project/git-ai), pas du rejeu.
- **Windsurf / Cascade** — https://docs.devin.ai/desktop/cascade (redirection
  depuis https://docs.windsurf.com/windsurf/cascade/cascade.md) — reverts et
  checkpoints nommés ; reverts irréversibles ; Cascade est legacy.

### 2.2 Git : reflog, stash, bisect

- **reflog** — https://git-scm.com/docs/git-reflog — « record when the tips of
  branches and other references were updated ».
- **stash** — https://git-scm.com/docs/git-stash — sauvegarde manuelle dans
  `refs/stash`.
- **bisect** — https://git-scm.com/docs/git-bisect — « uses a binary search
  algorithm » ; `git bisect run <cmd>` automatise le test.

### 2.3 Rejeu système et cassettes

- **rr** — https://rr-project.org/ et https://github.com/rr-debugger/rr —
  enregistrement/rejeu d'exécution et exécution inverse.
- **replay.io** — https://www.replay.io/how-it-works — enregistrement
  déterministe du runtime navigateur.
- **VCR.py** — https://vcrpy.readthedocs.io/en/latest/ — cassettes HTTP.
- **Polly** — https://github.com/App-vNext/Polly — résilience .NET. La brique de
  rejeu HTTP « Polly.Contrib.Rewind » n'a pas été retrouvée (404 sur nuget.org
  et sur GitHub le 13/11/2026) : **non vérifié**, on ne l'affirme pas.

### 2.4 Observabilité (concurrents de catégorie différente)

Ils **observent**, ils n'exécutent pas de prédicat sur un état.

- **LangSmith** — https://docs.smith.langchain.com/observability et
  https://docs.smith.langchain.com/evaluation — traces et évaluations sur
  jeux de données.
- **Langfuse** — https://langfuse.com/docs/observability/overview — tracing
  applicatif.
- **OpenTelemetry GenAI** — https://opentelemetry.io/docs/specs/semconv/gen-ai/
  (page déplacée vers
  https://github.com/open-telemetry/semantic-conventions-genai, statut
  « Development ») — conventions de télémétrie.

---

## 3. Écart structurel, par famille

- **Checkpoints / rollback d'agents (Claude Code, Cursor, opencode, Cline, Roo
  Code, Windsurf)** — sur la **capture**, ils sont plus proches de nous que ce
  que nous affirmions : ils prennent bien des instantanés d'état et les
  restaurent. Ce qu'ils ne font pas : **exécuter** quelque chose dessus, et
  donc jamais dire *quel* état casse le test. Leur granularité diffère aussi :
  opencode capture autour d'un appel de modèle, Roo Code avant modification de
  fichier, Claude Code avant un prompt.
- **Aider** — le cas le plus proche de nous, et il faut le dire : `--auto-test`
  relance bien un test après chaque édition, c'est un vrai « prédicat exécuté
  à chaque étape ». Mais il tourne sur l'état **courant** : il ne rejoue aucun
  état antérieur, il ne produit aucun index, et ses états vivent dans
  l'historique git, donc disparaissent au squash.
- **Cline / Roo Code (dépôts git ombrés)** — honnêtement, leur mechanism est
  plus proche de nous que ce que nous affirmions : dépôt git, commits, contenu
  adressé. Ce qui nous reste : l'exécution du prédicat sur chaque état,
  l'index de version fautive, et une chaîne d'attestation. En revanche, leurs
  dépôts ombrés survivent au squash du dépôt principal — ce qu'il faut leur
  créditer.
- **Codex CLI** — pas de mécanisme de checkpoint de fichiers ; l'utilisateur
  doit créer ses propres commits, avec le même sort qu'un squash.
- **`git bisect`** — c'est le concurrent le plus sérieux sur deux colonnes :
  `git bisect run` **exécute** un prédicat et **rend** l'index de la version
  fautive. Mesuré : après un `squash`, `git bisect` ne trouve plus de révision
  à tester (0 révision restante). L'écart réel n'est donc pas
  « bisect n'exécute pas » ; c'est que **bisect ne peut travailler que sur des
  commits qui existent**, alors que Rejeu indexe des états non commités.
- **`git reflog` / `git stash`** — ils conservent des versions, jamais un index
  ni un verdict ; le reflog est local et expire, le stash est manuel et
  mono-état.
- **`rr` / `replay.io` / `VCR.py` / `Polly`** — ils rejouent ou rejouent des
  **entrées/sorties d'un processus**, pas des **états d'un dépôt**. Ils ne
  peuvent structurellement pas produire un index de version fautive d'un dépôt :
  ils n'ont jamais les arbres. À l'inverse, `rr` capture une information que
  nous ne capturons pas : les appels système, les signaux, le non-déterministe.
  C'est une supériorité réelle de `rr` sur nous.
- **LangSmith / Langfuse / OpenTelemetry GenAI** — ils savoiront dire « 40 % des
  tours échouent » ; ils ne sauront pas dire « le checkpoint #3 casse le
  test », faute d'état à tester. Eux agrègent sur beaucoup de sessions ; nous
  ne le faisons pas du tout.

---

## 4. Limites de cette comparaison

1. **Aucune exécution des concurrents.** On a lu de la documentation et du
   code source, on n'a lancé ni Claude Code, ni Cursor, ni Cline, ni Roo Code,
   ni Continue, ni Windsurf, ni Codex CLI. Un comportement non documenté peut
   exister. Les seules choses réellement exécutées ici : `git bisect run`,
   `git reflog`, `git stash`, `git commit --amend`, `git squash`, `git gc`, et
   Rejeu lui-même.
2. **Polly.Contrib.Rewind : non vérifié** (404 nuget.org et GitHub le
   13/11/2026). Rien n'est affirmé sur une brique de rejeu Polly.
3. **Continue : absence de checkpoint documentée** — la doc officielle n'en
   parle pas ; seule l'intégration `git-ai` (attribution) a été trouvée dans le
   code. Un checkpoint non documenté dans l'IDE reste possible.
4. **Notre stockage face à `git gc` — défaut trouvé puis corrigé le 13 nov.**
   Mesuré d'abord : les arbres de checkpoint vivaient dans la base d'objets
   sans ref qui les protège ; `git gc` (grâce de 2 semaines) les conservait,
   `git gc --prune=now` **les supprimait**. Corrigé dans la foulée : chaque
   capture crée une ref `refs/rejeu/<session>/<index>`, donc l'arbre reste
   atteignable. Vérifié après un `git gc --prune=now` réel : l'arbre est
   toujours là et la chaîne se vérifie toujours. `chain.json` reste dans
   `.replay/`, ignoré par git dans notre dépôt : **la chaîne elle-même n'est
   pas versionnée chez nous** (elle est versionnable, à la main). Un
   concurrent comme Cline (dépôt ombré séparé) reste plus solide sur
   l'isolement du stockage.
5. **« Rejeu = git bisect + un stockage » n'est pas entièrement faux.** Le
   cœur de l'algorithme est une dichotomie sur une chaîne ordonnée, comme
   `git bisect`. Ce qui change : l'objet indexé est un **arbre non commité**
   (donc disponible là où bisect n'a plus de commits), le verdict vient d'une
   **exécution réelle**, et la chaîne d'attestation atteste de l'ordre des
   états. Un jury qui résumerait Rejeu à « bisect sur des arbres, avec une
   attestation » serait substantially correct.
6. **Coût et echelle non comparés.** Aucun chronométrage de nos concurrents
   sur un dépôt réel, aucune mesure de la taille de leurs instantanés.
   Claude Code plafonne à 100 checkpoints et purge à ~30 jours : sur une
   session longue, notre stockage peut être plus lourd — ou plus léger, selon
   le dépôt. Non mesuré.
7. **Le mode non coopératif n'est validé que sur un agent.** La capture par
   proxy MCP est démontrée sur une session réelle (3 appels d'outil → 2
   checkpoints, `fixtures/session-proxy/`), pas sur Claude Code, Cursor ou
   Cline : leur serveur d'outils n'est pas nécessairement interposable.
8. **Prédicat non déterministe :** nous suspendons le verdict ; un concurrent
   qui ejecuta un prédicat instable (aider `--auto-test`) ne le fait pas.
   Comparaison non faite avec eux.
9. **Continuité avec le projet** : les mesures du projet sont dans
   `docs/MESURES.md` ; la capture d'une session réelle d'agent y est notée
   « reste à faire » alors que le README décrit une session réelle — le
   dossier `fixtures/session-agent/` existe. Cette contradiction interne est
   hors périmètre ici, mais elle est réelle.

---

## Sources consultées (13/11/2026)

Claude Code : https://code.claude.com/docs/en/checkpointing ·
https://code.claude.com/docs/en/claude-directory.md
Cursor : https://cursor.com/docs/agent/overview.md
opencode : https://opencode.ai/docs/snapshots/
Codex : https://learn.chatgpt.com/docs/codex/cli.md ·
https://learn.chatgpt.com/docs/app-server.md
Aider : https://aider.chat/docs/git.html · https://aider.chat/docs/usage/lint-test.html ·
https://aider.chat/docs/usage/commands.html
Cline : https://docs.cline.bot/core-workflows/checkpoints
Roo Code : https://roocodeinc.github.io/Roo-Code/features/checkpoints/
Continue : https://docs.continue.dev/ ·
https://github.com/continuedev/continue (`extensions/cli/src/services/GitAiIntegrationService.ts`)
git-ai : https://github.com/git-ai-project/git-ai
Windsurf : https://docs.devin.ai/desktop/cascade
Git : https://git-scm.com/docs/git-reflog · https://git-scm.com/docs/git-stash ·
https://git-scm.com/docs/git-bisect · https://git-scm.com/docs/git-gc
rr : https://rr-project.org/ · https://github.com/rr-debugger/rr
replay.io : https://www.replay.io/how-it-works
VCR.py : https://vcrpy.readthedocs.io/en/latest/
Polly : https://github.com/App-vNext/Polly
LangSmith : https://docs.smith.langchain.com/observability ·
https://docs.smith.langchain.com/evaluation
Langfuse : https://langfuse.com/docs/observability/overview
OTel GenAI : https://opentelemetry.io/docs/specs/semconv/gen-ai/ ·
https://github.com/open-telemetry/semantic-conventions-genai
