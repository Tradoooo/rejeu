# Vidéo — `docs/demo/rejeu-demo.mp4`

- **Durée** : 66 s · **Format** : H.264 (libx264, `-crf 21`, `+faststart`), 1280×720, 25 i/s, 1,5 Mo.
- **Audio** : **aucun** — ni musique, ni narration, ni marque tierce. Tout le texte est à l'écran.
- **Fabrication** : `node scripts/capture-reel.mjs` (rejoue la session réelle et produit
  `fixtures/reel.json`) → `apps/web/reel.html` (reel) → `node scripts/record-demo.mjs`
  (Playwright enregistre, ffmpeg convertit).

## Les 15 premières secondes

| Temps | À l'écran | Pourquoi |
|---|---|---|
| 0:00–0:08 | « Un agent casse. L'équipe squash. La version fautive disparaît. » + le chiffre : **0** état retrouvé par la recherche manuelle sur une PR squashée, **#0** en **0,6 s** par rejeu, **20/20** localisations correctes, médiane **1,90 s** | le problème **et** le chiffre avant toute narration |
| 0:08–0:17 | le **diff réel** de l'erreur de l'agent (`parse` → `parseList`), la **sortie réelle** du test rouge, et l'**historique restant** (un seul commit) | la preuve du problème, tirée d'une session réelle |

## Le reste du reel

| Temps | Scène |
|---|---|
| 0:17–0:25 | la capture : la chaîne des checkpoints (arbres git) et sa vérification |
| 0:25–0:33 | le rejeu : la sortie réelle de `rejeu find` (verdict, temps, hôte intact) |
| 0:33–0:38 | la timeline : checkpoint #0 en échec, #1 en succès |
| 0:38–0:44 | le hook : `git commit --amend` refusé (sortie réelle) |
| 0:44–0:51 | le rapport imprimable (iframe du rapport réel) |
| 0:51–0:57 | les mesures : 20/20 · 1,90 s · 95/162 · 0 violation axe |
| 0:57–1:06 | la capture **non coopérative** : 3 appels d'agent → 2 checkpoints, sans qu'il le sache |
| 1:06–1:11 | les limites, puis le dépôt |

## Honnêteté du montage

Les sorties affichées ne sont pas recopiées : `scripts/capture-reel.mjs` **rejoue** la
session réelle de l'agent (état fautif extrait comme rejeu le fait, test exécuté,
diff produit par `git diff`, hook invoqué, `rejeu find` relancé) et écrit le résultat
dans `fixtures/reel.json`. Le reel ne fait que jouer ces sorties, caractère par
caractère. Aucun chiffre n'est écrit à la main dans la vidéo.

Ce que la vidéo **ne** montre pas : l'agent lui-même à l'écran (opencode n'a pas de
mode « film » ici) — la session est réelle, mais rejouée par l'outil.
