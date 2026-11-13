# Steering — produit

- **Une phrase** : rejeu rejoue les versions successives d'un dépôt
  traversées par un agent, et rend l'index de la version fautive.
- **Ce que l'outil est seul à produire** : un index (une version, pas une
  trace), établi par exécution réelle du prédicat sur chaque état, alors que
  `git bisect` exige des commits qui ont été squashés et qu'un traceur
  d'agent n'exécute aucun prédicat.
- **Ton** : factuel. Aucun chiffre sans la commande qui le produit. Un
  chiffre non encore mesuré est marqué `[cible]`.
- **Ce qu'on n'affirme pas** : la reproductibilité du modèle, l'honnêteté de
  l'agent qui a écrit le journal, la qualité du correctif.
