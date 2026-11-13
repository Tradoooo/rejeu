# Protocole de mesure de la perte — écrit, **non exécuté**

La grille exige que la perte actuelle soit chiffrée « avec la source ou la méthode
de mesure ». Ce fichier donne la **méthode**. Le chiffre, lui, n'existe pas
encore : il faut des chronométrages humains, que personne n'a faits.

## Ce qu'on sait mesurer sans personne

Mesuré le 13 novembre 2026 (`docs/MESURES.md`) :

| Voie | Résultat sur une PR squashée | Temps |
|---|---|---|
| Recherche manuelle (`git log -S`, `git bisect`) | **0 état intermédiaire retrouvé** — le commit fautif n'existe pas | indéfini |
| `rejeu find` | itération fautive **#0** | **0,6 s** |

C'est une mesure du **coût de l'outil**, pas de la **perte subie**. La perte
subie — le temps qu'une équipe passe à retrouver la version fautive quand
l'outil n'existe pas — exige des humains.

## Protocole pour mesurer la perte subie

1. **Population** : 3 à 5 équipes de 4 à 15 personnes qui reçoivent des PR
   produites par un agent de code, sur au moins un dépôt git. Critère
   d'inclusion : au moins une PR d'agent mergée par semaine, avec squash.
2. **Événement** : un incident de régression attribuable à une PR d'agent,
   découvert après la fusion.
3. **Ce qu'on chronomètre** (deux ingénieurs par équipe, en parallèle) :
   - le temps depuis la découverte du rouge jusqu'à l'identification de la
     **version** fautive (pas du fichier, pas de la ligne) ;
     - borne basse : 0 ; borne haute : 45 min (au-delà, on arrête et on note
       « non résolu ») ;
   - le temps total de l'incident (découverte → correctif mergé), pour separer
     la recherche de la réparation.
4. **Ce qu'on enregistre** : horodatages bruts, pas de moyenne arrondie ;
     la taille de la PR (fichiers, lignes) ; le nombre d'itérations de l'agent
     dans la session (si le journal existe) ; si l'historique avait été squashé.
5. **Base de comparaison** : la même équipe, la même tâche, avec Rejeu branché
     (broker ou proxy). On compare le temps de localisation, pas le temps de
     réparation.
6. **Échantillon minimum** : 10 incidents. En dessous, la dispersion rend la
     médiane non opposable ; on publie alors l'étendue, pas un chiffre unique.
7. **Ce qu'on ne fera pas** : annualiser un gain à partir d'une fréquence
     inventée (« 4 incidents par an »). Sans comptage réel des incidents sur la
     période, pas de projection.

## Ce que ce dépôt publie donc

- le coût de l'outil, mesuré (0,6 s contre une recherche indéfinie) ;
- la méthode de mesure de la perte, écrite ;
- **aucun** chiffre de perte subie.

Un chiffre de perte publié ici sans chronométrage serait une invention, et la
grille la sanctionne.
