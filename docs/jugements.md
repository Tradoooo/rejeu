# Jugement 1 — Rejeu construit (13 nov. 2026, ~16:35) — **60/100**

Juge indépendant (sous-agent), lecture limitée à la grille + 8 fichiers du dépôt.
Il n'avait jamais vu la fiche V2-05 ni les attaques. Il juge le **dépôt**, pas
l'idée.

| Critère | Note | Ce qui manque pour atteindre 20/20 |
|---|---|---|
| Impact | 8/20 | Perte subie non chiffrée ; utilisateur type non nommé ; prévalence invoquée sans source ; gain non affiché face à la voie manuelle ; version de Node exigée non documentée (friction cachée). |
| Kiro | 11/20 | Agent relecteur/testeur absent ; comparaison spec/vibe non faite ; hook prouvé par un script de test, pas par un incident ; `REJ-S-01` et `REJ-G-06` sans test vérificateur ; collision d'identifiants entre propriétés et exigences. |
| Design | 14/20 | Navigation clavier et `prefers-reduced-motion` non prouvés ; contraste AA non concluant (`color-mix`) ; thème clair/sombre absent des fichiers. |
| Innovation | 14/20 | Concurrent le plus proche non nommé (checkpoints/rollback des agents, `git reflog`, `git stash`) ; phrase de différenciation reformulable en « git bisect + stockage » ; pas d'élément non métaphorique. |
| Présentation | 13/20 | Plan des 15 premières secondes absent ; la vidéo montre un lecteur de sorties pré-enregistrées, pas l'outil en train de s'exécuter ; « sans musique » non affirmé ; Devpost en contradiction avec le dépôt (« 25 tests », « vidéo 59 s ») ; chiffres divergents entre fichiers. |
| **Total** | **60/100** | |

## Défauts qui coûtaient encore des points

1. **[Impact]** La perte actuelle n'est jamais chiffrée : le dossier mesure son
   propre coût (médiane 1,90 s, session réelle 3,0 s) mais pas les minutes que
   l'utilisateur perd à retrouver la version fautive.
2. **[Impact]** Aucun utilisateur type nommé avec son rôle et son contexte.
3. **[Impact]** La prévalence du problème est invoquée sans source.
4. **[Kiro]** Aucun agent personnalisé relecteur ni testeur.
5. **[Kiro]** Aucune comparaison chiffrée spec / vibe coding.
6. **[Kiro]** Aucun incident raconté d'un hook ayant bloqué une régression.
7. **[Kiro]** `REJ-S-01` et `REJ-G-06` n'ont pas de test vérificateur.
8. **[Kiro]** Collision d'identifiants entre les propriétés fast-check et les
   exigences du proxy.
9. **[Design]** Aucune preuve de navigation clavier ni de respect de
   `prefers-reduced-motion`.
10. **[Design]** L'AA n'est pas certifié : une règle de contraste non concluante.
11. **[Design]** Aucun élément n'établit un thème clair et sombre.
12. **[Innovation]** Le concurrent le plus proche n'est pas nommé.
13. **[Innovation]** La phrase « rejouer les versions, pas les logs » se
    reformule en « git bisect sur des arbres capturés ».
14. **[Présentation]** Aucun plan des 15 premières secondes publié.
15. **[Présentation]** La vidéo montre un lecteur HTML rejouant des sorties
    pré-enregistrées, pas l'outil s'exécutant.
16. **[Présentation]** « Sans musique » n'est affirmée nulle part.
17. **[Présentation]** Le Devpost contredit le dépôt sur ses propres chiffres.
18. **[Présentation]** Chiffres incohérents entre fichiers (bornes de temps,
    nombre de pages, outil nommé `rejeu_replay_checkpoint` au lieu de
    `replay_checkpoint`).
19. **[Présentation]** Le journal se dit « horodaté, sans reconstruction » mais
    ses entrées sont désordonnées.

## Verdict du juge 1

> Instrumentation exemplaire et dépôt techniquement propre, mais trois cases
> dures de la grille sont vides (perte non chiffrée, agents Kiro et comparaison
> spec/vibe absents, incident de hook non raconté) et les chiffres publiés se
> contredisent d'un fichier à l'autre : **60/100**.

---

# Jugement 2 — après corrections (13 nov. 2026, ~17:10) — **78/100**

Second passage, même méthode : grille + 12 fichiers du dépôt (README, DEVPOST,
MESURES, VIDEO, CONCURRENTS, journal, specs, agents, résultats de l'expérience).

| Critère | Note | Ce qui manque pour atteindre 20/20 |
|---|---|---|
| Impact | 13/20 | La perte n'est pas chiffrée (protocole écrit, non exécuté) ; l'écart avec la recherche manuelle est binaire, pas en minutes ; rien n'établit la fréquence du problème ; le mode automatique impose de câbler un serveur MCP et le mode coopératif impose que l'agent appelle `replay_checkpoint` : la friction n'est pas nulle. |
| Kiro | 15/20 | Le contre-exemple réel a été trouvé par un test déterministe, pas par une propriété fast-check ; la comparaison spec/vibe ne chiffre aucun écart de défauts au résultat final et ses durées sont déclaratives ; l'effet avant/après du steering n'est pas montré ; le hook n'est appliqué que par le proxy. |
| Design | 19/20 | Aucune trace d'exécution d'axe jointe au dépôt, et les documents se contredisent sur le nombre de pages (3 contre 4) et sur le nombre de contrôles non concluants (1 contre 0) : la correction a été faite mais le journal n'a pas été remis à jour. |
| Innovation | 16/20 | « Aucun outil existant ne fait ça » n'est pas tenable : `git bisect run` exécute un prédicat et rend l'index, Aider `--auto-test` relance la suite à chaque édition, les dépôts ombrés de Cline/Roo Code survivent au squash. La garantie propre se réduit à « prédicat exécuté sur des états non commités ». |
| Présentation | 15/20 | Trois durées de vidéo (59/66/69 s) et deux tailles coexistent ; le Devpost annonce « deux « non fait » » alors que ses huit réponses commencent par « Oui » ; 38 tests annoncés contre 39 ; le README affirme encore que la session réelle et la vidéo ne sont pas faites ; le temps de session est tantôt 0,6 s tantôt 3,0 s ; la vidéo ne montre ni l'agent ni le CLI ; le « moins de 30 s » n'est mesuré nulle part. |
| **Total** | **78/100** | |

## Ce qui a été corrigé depuis 60/100 (extrait)

1. Les chiffres existent maintenant et ont une commande (banc, a11y, reel).
2. Session réelle d'agent (broker) — régression localisée #0.
3. Capture non coopérative (proxy) — 3 appels → 2 checkpoints.
4. Vidéo réellement tournée (MP4, sans audio, sorties produites par exécution).
5. Accessibilité passée de l'affirmation à la mesure (axe, clavier, mouvement, thèmes).
6. Comparaison spec/vibe publiée ; chiffres de la fiche abandonnés.
7. Hook : script de test + **incident réel** daté et transcrit.
8. Relecteur en lecture seule : il a trouvé une exigence sans vérificateur.
9. Défaut de stockage trouvé et corrigé (`git gc --prune=now` effaçait les arbres).
10. Démonstration hors ligne en 4 pages, rapport A4, 39 tests, CI verte.
11. Deux affirmations trop fortes corrigées au lieu d'être défendues
    (`git bisect run`, checkpoints d'agents).

## Défauts restants (extrait, 18 au total)

Perte non chiffrée ; suppression de la perte non mesurée en durée ; aucune
donnée de fréquence ; friction d'adoption ; contre-exemple trouvé par un test et
non par une propriété ; comparaison spec/vibe sans écart de défauts mesuré ;
effet du steering non montré ; hook appliqué seulement au proxy ; trace d'axe
non jointe et documents contradictoires ; « aucun outil existant ne fait ça »
non tenable ; durées/taille de vidéo divergentes ; Devpost incohérent avec le
dépôt ; 38 tests contre 39 ; README en retard sur lui-même ; temps de session
divergent ; la vidéo ne montre pas l'outil en train de s'exécuter ; « moins de
30 s » et « moins de 60 s » non mesurés.

## Verdict du juge 2

> 78/100 : le projet a aerialement transformé une fiche de 60 points en un dépôt
> mesuré et reproductible — session réelle d'agent, capture non coopérative,
> vidéo tourné, accessibilité mesurée, comparaison des concurrents vérifiée et
> deux défauts corrigés par ce travail — mais il reste, en toute connaissance de
> cause, un impact dont la perte n'est pas chiffrée, une preuve fast-check dont
> le contre-exemple n'a pas été trouvé par une propriété, une accessibilité dont
> la trace reste contradictoire dans le dépôt, une différenciation qui se réduit
> à « bisect sur des états non commités » et une documentation dont les chiffres
> de tête ne concordent plus entre eux.

---

# Ce qui a été fait après ces deux jugements (13 nov., 17:10 → 17:30)

| Défaut signalé | Correctif |
|---|---|
| Contre-exemple trouvé par un test, pas par une propriété | **REJ-P-06** (fast-check, graine 20261104) : échec sur le code d'avant le correctif, passe sur le code actuel — sorties des deux exécutions dans `docs/preuves/propriete-contre-exemple.txt` |
| Effet du steering non montré | **6 faux écarts → 0** sur 7 captures (`scripts/measure-steering.mjs`, `docs/preuves/steering.json`) |
| « moins de 30 s » / « moins de 60 s » non mesurés | **0,38 s** (verdict dans la démo) et **0,77 s** (première valeur sur un dépôt vierge) — `scripts/measure-claims.mjs` |
| Chiffres divergents (vidéo, tests, pages, contraste, temps de session) | un **tableau unique** dans le journal ; entrées datées annotées quand elles ont été corrigées ; extent publié (0,5 à 3,2 s) au lieu d'un chiffre unique |
| Chaîne non versionnable | `rejeu export` copie `chain.json` vers `replay/<session>/` |
| Trace d'axe non jointe | le contrôle **refuse** désormais de valider une page qui ne rend rien (le bug `app.js` du 13 nov. aurait été sinon « validé ») |

Reste ouvert, et assumé : la perte subie (chronométrage humain), la
généralisation de la comparaison spec/vibe, la capture d'un agent sans serveur
MCP, et le fait que la vidéo rejoue les sorties de l'outil sans montrer l'agent.
