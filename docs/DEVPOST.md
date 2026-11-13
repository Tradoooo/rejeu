# Rejeu — texte de soumission

**Nom** : Rejeu (Agent Replay)
**Catégorie** : Frankenstein — le magnétoscope ressuscité ; la bobine est l'historique de versions d'un agent.
**Dépôt** : https://github.com/Tradoooo/rejeu · **Démo** : https://tradoooo.github.io/rejeu/

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

## Les chiffres, et leur commande

| Chiffre | Valeur | Commande |
|---|---|---|
| localisations correctes | 20/20 | `node corpus/generate.mjs && node corpus/measure.mjs` |
| temps médian par session | 1,90 s | idem (`docs/MESURES.md`) |
| checkpoints rejoués | 95/162 | idem |
| chaînes vérifiées / hôtes intacts | 20/20 · 20/20 | idem |
| violations axe | 0 | `node scripts/a11y.mjs` |
| vidéo | 59 s, H.264, sorties réelles | `node scripts/capture-reel.mjs && node scripts/record-demo.mjs` |
| session réelle d'agent | fautive #0 localisée en 3,0 s | `fixtures/session-agent/` (opencode + broker) |
| tests | 25 | `pnpm test:run` |

## Les limites, écrites

- Le rejeu ne prouve pas que le modèle est reproductible ; un taux d'accord se **mesure**, il ne se suppose pas.
- Seuls les appels passés par le broker sont capturés.
- Linux uniquement pour la coupure réseau ; macOS/Windows hors périmètre v0.1.
- La chaîne prouve l'intégrité du journal, pas l'honnêteté de l'agent.
- La capture est **coopérative** (l'agent appelle le checkpoint) ; le proxy d'outils transparent reste à faire.
- La vidéo est faite (59 s) ; elle montre une session réelle, pas une maquette.
