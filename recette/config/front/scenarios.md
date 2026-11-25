# Scénarios de recette — Front

**Source de vérité** des scénarios : les specs `tests/web/scenarios/*.spec.js` n'en sont qu'une
transcription (voir `tests/web/scenarios/README.md`) — jamais l'inverse.

Chaque scénario est délimité par une ligne `---`. Format :

    ## [SC-NNN] Titre
    **Priorité** : haute | moyenne | basse
    **Catégorie** : navigation | carte | filtre | ...

    Description en langage naturel des étapes.

    **Résultat attendu** : ce que la personne observe à la fin.
    **Si c'est faux** : ce que la personne (ou la personne qui publie les traces) perd.

Conventions : un ID `SC-NNN` n'est jamais réutilisé ; un scénario décrit un comportement observable, pas des
sélecteurs (ceux-ci vivent dans `selectors.md`) ; aucune URL, identifiant ou donnée réelle. Un point de contrôle sans
« Si c'est faux » est supprimé ou fusionné avec un autre.

Le point de vue est celui de la personne qui utilise le site pour trouver une trace et l'emporter. Les scénarios « ordinateur »
jouent avec une souris (survol, clic), les scénarios « smartphone » simulent un écran tactile (appui, pas de survol). Tout se joue
sur le site de `RECETTE_URL`, sauf SC-012 et SC-013 qui jouent sur une copie locale du site, avec un Drive simulé.

---

## [SC-001] La carte et les traces s'affichent (ordinateur)
**Priorité** : haute
**Catégorie** : carte

Ouvrir la page d'accueil sur un écran d'ordinateur.

**Résultat attendu** : le titre de la page et la carte sont affichés correctement ; autant de traces sont dessinées que le fichier de
traces en contient (au moins une) ; les cases de filtres sont visibles ; la page ne signale aucune erreur.
**Si c'est faux** : la personne voit une carte vide ou cassée et ne trouve aucune trace à emporter ; une erreur de page peut en plus
rendre les filtres ou le téléchargement inutilisables sans qu'elle comprenne pourquoi.

---

## [SC-002] Survol d'une trace (ordinateur)
**Priorité** : haute
**Catégorie** : carte

Amener la souris sur une trace visible de la carte, puis l'éloigner.

**Résultat attendu** : une infobulle affiche le nom de la trace et la trace passe en rouge ; en éloignant la souris, la
trace retrouve sa couleur et l'infobulle disparaît.
**Si c'est faux** : la personne ne sait pas quelle trace elle survole (nom de la sortie) et ne distingue pas les traces superposées.

---

## [SC-003] Ouverture et fermeture de la fenêtre d'une trace (ordinateur)
**Priorité** : haute
**Catégorie** : carte

Cliquer sur une trace visible, puis éloigner la souris, puis fermer la fenêtre avec sa croix.

**Résultat attendu** : une fenêtre s'ouvre avec le nom de la trace et un lien de téléchargement ; la trace reste en rouge tant que la
fenêtre est ouverte, même souris éloignée ; à la fermeture, la trace retrouve sa couleur.
**Si c'est faux** : la personne n'a pas accès au téléchargement, ou ne sait plus quelle trace est sélectionnée.

---

## [SC-004] Filtrer les traces par catégorie (ordinateur)
**Priorité** : haute
**Catégorie** : filtre

Pour chaque catégorie (parcours, chemin boueux, chemin inondable, danger, autres), décocher la case puis la recocher.

**Résultat attendu** : décocher une catégorie masque exactement les traces de cette catégorie (zéro si elle n'en a aucune) ;
la recocher les réaffiche toutes.
**Si c'est faux** : la personne voit encore des chemins dangereux ou inondables qu'elle a masqués, ou perd des traces qu'elle croit
visibles : elle choisit sa sortie sur une carte fausse.

---

## [SC-005] Filtrer les parcours par distance (ordinateur)
**Priorité** : moyenne
**Catégorie** : filtre

Pour chaque distance proposée (moins de 8 km, 8 à 10 km, 10 km et plus, distance inconnue), décocher la case puis la recocher ;
puis décocher toutes les distances ; puis masquer la catégorie « parcours ».

**Résultat attendu** : décocher une distance masque exactement les parcours de cette distance et aucune autre trace ; tout
décocher masque tous les parcours seulement ; la case « distance inconnue » n'est proposée que si un parcours n'a pas de
distance ; quand les parcours sont masqués, les filtres de distance apparaissent grisés.
**Si c'est faux** : la personne se voit proposer des parcours trop longs ou trop courts pour sa sortie, ou ne retrouve pas ceux qui
lui conviennent.

---

## [SC-006] Afficher et masquer sa position GPS (ordinateur)
**Priorité** : moyenne
**Catégorie** : carte

Avec la localisation autorisée, cliquer sur « Afficher ma position GPS », puis sur le même bouton une seconde fois.

**Résultat attendu** : un repère de position apparaît sur la carte, avec son image, et le bouton propose de masquer la position ;
au second clic, le repère disparaît et le bouton propose de nouveau de l'afficher.
**Si c'est faux** : la personne ne peut pas se situer par rapport aux traces proches, ou garde un repère qu'elle ne peut plus retirer.

---

## [SC-007] La carte et les traces s'affichent (smartphone)
**Priorité** : haute
**Catégorie** : carte

Ouvrir la page d'accueil sur un écran de smartphone (tactile, 390 × 844).

**Résultat attendu** : la carte est utilisable (taille suffisante, pas de défilement horizontal de la page) ; toutes les traces du
fichier sont dessinées ; les filtres et le bouton de position sont accessibles ; la page ne signale aucune erreur.
**Si c'est faux** : sur téléphone, usage principal en extérieur, la personne ne peut pas consulter les traces.

---

## [SC-008] Appui sur une trace (smartphone)
**Priorité** : haute
**Catégorie** : carte

Appuyer sur une trace visible, puis sur la croix de la fenêtre.

**Résultat attendu** : une fenêtre s'ouvre avec le nom de la trace et un lien de téléchargement, la trace passe en rouge, sans
infobulle (il n'y a pas de survol au toucher) ; à la fermeture, la trace retrouve sa couleur.
**Si c'est faux** : la personne ne peut pas choisir une trace au doigt, ni la télécharger.

---

## [SC-009] Filtrer au toucher (smartphone)
**Priorité** : moyenne
**Catégorie** : filtre

Appuyer sur une case de catégorie pour la décocher, puis de nouveau pour la recocher.

**Résultat attendu** : les traces de la catégorie sont masquées puis toutes réaffichées, comme sur ordinateur.
**Si c'est faux** : les filtres sont inutilisables au doigt : la personne ne peut pas trier les traces sur son téléphone.

---

## [SC-010] Télécharger le GPX d'une trace (ordinateur)
**Priorité** : haute
**Catégorie** : téléchargement

Cliquer sur une trace, puis sur son lien de téléchargement.

**Résultat attendu** : un fichier se télécharge ; son nom se termine par `.gpx` et correspond à la trace ; son contenu est un
fichier GPX exploitable dont le premier point est celui du début de la trace affichée.
**Si c'est faux** : la personne repart avec un fichier inutilisable dans son appareil, ou avec le tracé d'une autre sortie que celle choisie.

---

## [SC-011] Télécharger le GPX d'une trace (smartphone)
**Priorité** : haute
**Catégorie** : téléchargement

Appuyer sur une trace, puis sur son lien de téléchargement.

**Résultat attendu** : un fichier se télécharge ; son nom se termine par `.gpx` ; son contenu est un fichier GPX exploitable dont le
premier point est celui du début de la trace affichée.
**Si c'est faux** : même perte que SC-010, sur le téléphone que la personne emporte en sortie.

---

## [SC-012] Une trace déposée sur le Drive apparaît sur le site (site local, Drive simulé)
**Priorité** : haute
**Catégorie** : publication

Sur une copie locale du site dont le Drive est simulé : noter les traces affichées ; déposer un nouveau fichier GPX dans le
Drive simulé ; relancer la publication ; recharger la page.

**Résultat attendu** : avant le dépôt, le site affiche les traces du Drive ; après la publication, il affiche une trace de plus,
portant le nom du fichier déposé ; cette trace s'ouvre dans une fenêtre et se télécharge en un fichier GPX exploitable dont le
premier point est celui du début de la trace affichée ; les autres traces sont inchangées.
**Si c'est faux** : la personne qui publie dépose une trace que personne ne verra jamais, ou qui en fait disparaître d'autres.

---

## [SC-013] Une trace « parcours » déposée est classée selon sa distance (site local, Drive simulé)
**Priorité** : moyenne
**Catégorie** : publication

Sur la copie locale : déposer un fichier GPX dont le nom annonce un parcours de 12 km ; publier ; ouvrir le site ; décocher la
distance « 10 km et plus », puis la recocher.

**Résultat attendu** : la nouvelle trace est rangée dans les parcours « 10 km et plus » : elle disparaît quand cette distance est
décochée et réapparaît quand elle est recochée ; elle n'est pas rangée dans une autre catégorie.
**Si c'est faux** : le parcours est introuvable pour qui filtre sur sa distance, ou apparaît parmi des chemins qui ne sont pas des parcours.
