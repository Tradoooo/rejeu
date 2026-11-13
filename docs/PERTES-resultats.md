# La perte, enfin mesurée — étude à trois bras

Document de travail du 13 novembre 2026. Tout ce qui est chiffré ici a été
**exécuté** ; la méthode est reproductible (`corpus/study/`).

- Génération des cas : `node corpus/study/generate-cases.mjs 10 /tmp/rejeu-study2`
- Analyse : `node corpus/study/score.mjs /tmp/rejeu-study2 /tmp/rejeu-study2/answers.json`
- Données brutes : `docs/preuves/etude-avec-capture.json`,
  `docs/preuves/etude-sans-capture.json`

## Ce que l'on mesure

Une situation réelle de hackathon : un agent itère sur un dépôt, puis la PR est
**squashée** — l'historique d'itération disparaît, il ne reste qu'un commit.
Un test échoue. Question posée aux sujets : **quelle modification a cassé le
test, et à quelle itération de l'agent ?**

Chaque cas est un dépôt git réel : 8 modules, un diff de PR de ~190 lignes, une
seule modification fautive, une chaîne de checkpoints capturée pendant
l'agent, et une PR squashée (2 commits : la base, puis le squash).

| Bras | Ce que le sujet a | n |
|---|---|---|
| **sans capture** | le dépôt seul, sans `.replay/`, sans les refs | 5 |
| **manuel** | le dépôt + la chaîne de checkpoints, sans outil | 9 |
| **rejeu** | le dépôt + la chaîne + `rejeu find` | 9 |

Les sujets sont des agents (même modèle, même outillage) ; ils reçoivent la
même consigne et ne peuvent modifier aucun fichier.

## Les résultats

| | sans capture | manuel | rejeu |
|---|---|---|---|
| **itération correcte** | **4/5** | **9/9** | **9/9** |
| fichier correct | 5/5 | 9/9 | 9/9 |
| temps médian | **42 min 40 s** | **5 min 44 s** | 7 min 59 s |
| temps min / max | 19 min 21 s / 73 min 36 s | 2 min 54 s / 10 min 21 s | 5 min 14 s / 9 min 26 s |
| appels d'outils (médian) | 19 | 15 | 19 |

## Trois lectures, dont une qui nous coûte

**1. Sans capture, l'information survit — mais il faut de l'archéologie git.**
4 sujets sur 5 ont retrouvé l'itération exacte. Tous l'ont fait **de la même
manière** : `git fsck` pour exhuminer les arbres *orphelins* (les refs avaient
été supprimées, les objets restaient), puis rejouer les tests sur chaque arbre
un par un. Un sujet a répondu `ITERATION: inconnue` : il n'a pas eu l'idée.
Médiane : **42 minutes**, jusqu'à **73 minutes**. Autrement dit : ce n'est pas
que l'information disparaît, c'est qu'elle devient **coûteuse à exhumer** — et
parfois introuvable.

**2. La capture est ce qui rend l'itération trouvable.** Une fois la chaîne
présente, 9 sujets sur 9 trouvent la bonne itération, en 5 min 44 s de
médiane — et en réécrivant eux-mêmes la boucle que fait `rejeu find`.

**3. Notre outil n'est pas plus rapide qu'un agent qui refait la boucle.** Le
bras « rejeu » est **plus lent** en temps de mur (7 min 59 s contre 5 min 44 s)
que le bras « manuel ». La raison est visible dans les transcriptions : avec
l'outil, les sujets **vérifient** leur réponse en rejouant les arbres à la
main — ils ne se fient pas au verdict et refont le travail. L'outil donne la
même réponse en **1 commande et ~1 seconde** (`rejeu find` : 0,5 à 1,9 s
mesuré sur les 10 cas) ; le temps de mur du bras est dominé par la latence du
modèle, pas par la recherche.

Autrement dit : **l'outil supprime le travail, pas la latence**. Pour un agent,
la différence se voit dans le nombre d'étapes (1 contre 15 à 19) et dans la
reproductibilité (le verdict est le même à chaque exécution) ; elle ne se voit
pas dans la seconde.

## Deux défauts de l'étude, déclarés

1. **Un cas sur dix était invalide** (`cas-05`) : la variante fautive de
   `bornes` n'est **pas détectée** par son propre test — `bornes(0,10,15)`
   vaut 10 dans les deux formulations. Le cas a été **exclu** des chiffres
   (d'où 9 et non 10). C'est aussi une vraie limite de l'outil : *si aucun
   prédicat ne détecte la faute, rien ne peut être localisé* — et `rejeu find`
   le dit honnêtement (« aucun checkpoint ne fait échouer le prédicat »),
   au lieu d'inventer un coupable.
2. **Un pilote précédent fuyait** : la première version du banc écrivait
   « itération N » dans un commentaire du fichier, ce qui permettait aux
   sujets de lire la réponse. Corrigé (le banc v2 ne contient plus d'indice) ;
   le pilote n'est pas publié comme résultat.

## La fréquence, mesurée sur tes dépôts

`scripts/measure-frequency.mjs` (API GitHub, 10 dépôts de l'organisation) :

| | Valeur |
|---|---|
| PRs mergées analysées | **616** |
| fusionnées à **un seul commit** (historique d'itération effacé) | **615 — 99,8 %** |
| qui avaient **plusieurs commits** avant fusion (donc l'agent avait itéré) | **204 — 33,1 %** |

Autrement dit : **un tiers des PRs mergées de ce portefeuille portaient une
histoire d'itération qui a été effacée au moment de la fusion.** C'est la
population concernée, comptée sur des dépôts réels — pas une estimation.

## Ce qui reste non mesuré

- **Des sujets humains.** Les sujets de cette étude sont des agents : la
  comparaison est valide *entre bras*, elle ne donne pas un temps humain.
  Le protocole pour l'humain est dans `docs/PERTES.md`.
- **Un seul modèle, une seule journée, un diff de ~190 lignes.** Une vraie PR
  d'agent fait souvent dix fois plus.
- Le **gain en minutes** n'est pas établi : chez des agents, il est noyé dans
  la latence. Ce que l'étude établit, c'est le *coût* de l'absence de capture
  (19 à 73 min d'archéologie, ou l'échec) et l'**exactitude** de la sortie.
