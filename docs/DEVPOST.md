# Rejeu — texte de soumission

**Nom** : Rejeu (Agent Replay)
**Catégorie** : Frankenstein — le magnétoscope ressuscité ; la bobine est l'historique de versions d'un agent.
**Dépôt** : https://github.com/Tradoooo/rejeu · **Démo** : https://tradoooo.github.io/rejeu/ · **Vidéo** : `docs/demo/rejeu-demo.mp4` (69 s, sans audio) · **Découpage** : `docs/VIDEO.md`

## Une phrase

Rejeu rejoue les **versions successives d'un dépôt** traversées par un agent de code et rend **l'index de la version fautive**, par exécution réelle du prédicat sur chaque état.

## Quel problème ça résout ?

Un agent itère, corrige son propre test rouge, puis l'équipe `squash` la PR « pour la rendre propre ». Les états intermédiaires disparaissent : la version qui a introduit la régression n'existe plus. `git bisect` exige des commits existants ; un traceur d'agent n'exécute aucun prédicat ; un log ne porte pas l'état du dépôt. Rejeu rend l'information récupérable **après coup**, dans la session du jour.

## Comment ça marche ?

1. **Capture** — un broker MCP s'interpose entre l'agent et ses outils ; après chaque appel mutant, il écrit un checkpoint : `git write-tree`, arbre adressé par contenu, digest chaîné sur le précédent.
2. **Rejeu** — chaque checkpoint est extrait dans un répertoire jetable (`mkdtemp`), le réseau est coupé (`unshare -n`), `TZ=UTC`, `SOURCE_DATE_EPOCH=0`, variables `GIT_*`/`GH_*`/`AWS_*` retirées ; le prédicat y est **réellement exécuté**.
3. **Verdict** — balayage linéaire, ou dichotomie quand le prédicat est monotone ; le premier index où le prédicat bascule est rejoué deux fois ; s'il ne se reproduit pas, le verdict est **suspendu** (« non déterministe ») au lieu de deviner.
4. **Artefacts** — `chain.json` (chaîne d'attestation vérifiable par `rejeu verify`), `report.html` imprimable A4, `session-digest.txt`.

## Comment Kiro a servi ?

- `.kiro/specs/replay/requirements.md` : exigences **EARS**, chacune avec son **vérificateur** nommé (fichier + test). Une exigence sans test rouge possible n'entre pas dans la spec.
- `.kiro/steering/determinism.md` : la règle « un checkpoint ne dépend jamais de l'horloge murale », née d'un contre-exemple réel (voir plus bas).
- `.kiro/hooks/checkpoint-guard.sh` : hook pré-outil qui **refuse** `git commit --amend`, `git reset --hard`, `git checkout -- .` pendant une session capturée ; prouvé par un script exécuté en CI (3 blocages, 3 passages).
- Broker MCP : `replay_checkpoint`, `first_faulty`, `verify_chain` — c'est le point d'intégration avec le CLI headless.

## Le contre-exemple réel

La propriété « deux captures du même état donnent le même arbre » a **échoué** : la capture écrivait `.replay/chain.json` dans l'arbre qu'elle capturait, donc chaque capture produisait un arbre différent. Détectée par `store.test.ts`, corrigée par `ALWAYS_IGNORED` (`.replay/`, `.git/`, `node_modules/`). Deuxième chemin du même défaut : un script écrivant `Date.now()` dans un fichier suivi — verrouillé par `version-property.test.ts`. Journal complet : `KIRO_JOURNAL.md`.

## Les huit questions Kiro

| Question Kiro | Réponse |
|---|---|
| Les specs EARS sont-elles dans `.kiro/specs/` ? | Oui — `replay/requirements.md`, 20 exigences, chacune avec son vérificateur nommé. |
| Une propriété fast-check a-t-elle échoué pour de vrai ? | Oui — la capture se capturait elle-même (`.replay/` dans l'arbre) : deux captures du même état donnaient deux arbres. Test rouge, correctif, journal. |
| Un hook a-t-il bloqué quelque chose ? | Oui, et c'est un **incident réel** : pendant une session capturée, un agent (opencode) a tenté `git commit --amend --no-edit` ; le hook l'a refusé et la commande n'a jamais atteint `git`. Daté, transcrit et publié dans `fixtures/session-hook/incident.md`. Reproductible via `.kiro/hooks/checkpoint-guard.test.sh`. |
| Un agent personnalisé en lecture seule ? | Oui — `relecteur` (lecture seule, vérifie chaîne + exigence ↔ vérificateur) et `testeur` (exécute en bac à sable sans écrire). Implémentés comme scripts exécutables (`tools/relecteur.mjs`, `tools/testeur.mjs`) et définis en `.kiro/agents/`. Le relecteur a déjà trouvé un défaut réel : une exigence sans vérificateur. |
| Une comparaison chiffrée spec / vibe coding ? | Oui, sur une fonction précise (`isIgnored`) : `experiments/spec-vibe/`. Même modèle, même outillage, différence unique = la présence de la spec. Résultat : 14/14 dans les deux lots, mais 0 correction contre 1, 75 lignes/22 tests contre 128 lignes/9 tests. Limites assumées dans `RESULTATS.md`. |
| Un usage mesurable de MCP ? | Oui — deux brokers MCP (coopératif et non coopératif) et deux sessions d'agent réelles, avec les temps. |
| Le steering a-t-il eu un effet avant/après ? | Oui — `determinism.md` (règle d'exclusion) est né d'un défaut mesuré ; l'effet est vérifiable par deux tests. |
| Le chiffre est-il produit par l'outil ? | Oui — l'index de la version fautive sort d'une exécution réelle ; les temps viennent du banc rejouable. |
| La perte subie est-elle chiffrée ? | **En partie, et sans invention.** L'étude à trois bras (`docs/PERTES-resultats.md`) mesure le coût de l'absence de capture (19 à 73 min d'archéologie git, ou l'échec : 1 sujet sur 5) sur des sujets **agents** ; la fréquence est comptée sur 616 PRs réelles (33,1 % avec des itérations effacées). Le chronométrage **humain** reste à faire — le protocole est écrit (`docs/PERTES.md`). |

## Les chiffres, et leur commande

| Chiffre | Valeur | Commande |
|---|---|---|
| localisations correctes | 20/20 | `node corpus/generate.mjs && node corpus/measure.mjs` |
| temps médian par session | 1,90 s | idem (`docs/MESURES.md`) |
| checkpoints rejoués | 95/162 | idem |
| chaînes vérifiées / hôtes intacts | 20/20 · 20/20 | idem |
| violations axe | 0 (et 0 contrôle non concluant) | `node scripts/a11y.mjs` |
| navigation clavier | 11 éléments focalisés, focus visible partout | `node scripts/a11y.mjs` |
| `prefers-reduced-motion` | transitions et animations à 0 s | `node scripts/a11y.mjs` |
| vidéo | 69 s, H.264, sans audio, sorties réelles | `node scripts/capture-reel.mjs && node scripts/record-demo.mjs` |
| session squashée | recherche manuelle : **0 état retrouvé** ; rejeu : **#0 en 0,5–3,2 s** | `docs/MESURES.md` |
| étude à 3 bras | sans capture : itération retrouvée **4/5** en **42 min** de médiane (archéologie `git fsck`) ; avec capture : **9/9** ; `rejeu find` seul : **~1 s** | `docs/PERTES-resultats.md` |
| fréquence du problème | **616** PRs mergées analysées, **615** squashées (99,8 %), **204** avec des commits d'itération effacés (33,1 %) | `scripts/measure-frequency.mjs` |
| démo en ligne | verdict affiché en **0,38 s** | `scripts/measure-claims.mjs` |
| première valeur (dépôt vierge) | **0,77 s** | `scripts/measure-claims.mjs` |
| steering avant/après | **6 faux écarts → 0** sur 7 captures | `scripts/measure-steering.mjs` |
| session réelle d'agent | fautive #0 localisée (0,5 à 3,2 s selon la charge) | `fixtures/session-agent/` (opencode + broker) |
| capture non coopérative | 3 appels d'agent → 2 checkpoints | `fixtures/session-proxy/` (proxy MCP) |
| tests | 40 | `pnpm test:run` |

## Les limites, écrites

- Le rejeu ne prouve pas que le modèle est reproductible ; un taux d'accord se **mesure**, il ne se suppose pas.
- Seuls les appels passés par le broker sont capturés.
- Linux uniquement pour la coupure réseau ; macOS/Windows hors périmètre v0.1.
- La chaîne prouve l'intégrité du journal, pas l'honnêteté de l'agent.
- Deux modes de capture : coopérative (l'agent appelle le checkpoint) ou **non coopérative** (un proxy MCP enveloppe les outils de l'agent et capture chaque changement d'état). Le second mode exige que l'agent passe par un serveur MCP enveloppé.
- La vidéo est faite (69 s, sans audio) ; elle montre une session réelle, pas une maquette.
