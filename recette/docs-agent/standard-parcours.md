# Standard — Un parcours de test qui sert l'utilisateur final et celui qui le déroule

Grille pour rédiger, relire et dérouler les parcours de `config/front/parcours.md` et les scénarios de `config/front/scenarios.md`.
Elle s'applique à toute évolution de la recette.

## Intention

*L'intention du geste, pour s'adapter sans perdre de vue le résultat final.*

- Chaque vérification protège ce que l'utilisateur final attend du site : trouver une trace, l'emporter, ou la publier.
- Le parcours se déroule vite, sans interruption ni pénibilité pour la personne qui le lance : son attention va aux défauts, pas à l'outillage.
- Parcours, automatisation et doc avancent ensemble et arrivent dans le même commit.

## Les erreurs types

*Pour éviter de les répéter.*

- ❌ Un parcours devient une liste d'écrans à visiter, qui passe sans rien prouver (« la carte s'affiche »).
- ❌ On oublie de se mettre à la place de l'utilisateur final : tout est joué sur un grand écran avec une souris alors que la trace se choisit sur téléphone, au doigt.
- ❌ On rédige la définition et on remet « à plus tard » les specs, les sélecteurs et la doc : le commit est incomplet et le parcours jamais rejoué.
- ❌ La doc devient un lieu de remplissage (description de l'outil, de la recette, historique) au lieu d'aider un utilisateur.

## Les points clés

*Pour savoir si la pièce est OK ou not OK.*

### ✅ Le parcours part d'un besoin : qui, pour obtenir quoi

*Pour que chaque étape serve un résultat que l'utilisateur reconnaît.*

La personne (persona, contexte) et la valeur recherchée sont nommées dans la ligne **Besoin** du parcours. Les parcours sont regroupés par action
métier (consulter, télécharger, publier), pas par module technique.

Exemple : P-001 — une personne qui prépare une sortie à pied ou à vélo, sur ordinateur ou sur téléphone — trouver la trace qui lui convient.

### ✅ Chaque point de contrôle décrit un résultat que l'utilisateur observe

*Pour qu'un échec se traduise en une phrase d'impact.*

Question de contrôle : « si c'est faux, qu'est-ce que l'utilisateur perd ? ». Sans réponse, on supprime ou on fusionne. La réponse s'écrit dans la ligne
**Si c'est faux** du scénario. L'attendu est assez précis pour que deux personnes rendent le même verdict.

Exemples :

- ❌ « Les traces sont chargées »
- ✅ « Autant de traces sont dessinées que le fichier de traces en contient ; si c'est faux, la personne voit une carte vide et ne trouve aucune trace à emporter »

### ✅ L'effet réel est vérifié, pas seulement l'écran

*L'affichage peut être juste alors que l'effet est faux.*

Le point de contrôle dit **où** regarder quand l'écran ne prouve pas la valeur (fichier téléchargé, fichier de traces publié, service tiers). Les valeurs
chiffrées sont vérifiées en valeur.

Exemples :

- Le lien de téléchargement ne suffit pas : le fichier reçu est un GPX exploitable et son premier point est le début de la trace affichée (SC-010).
- Les cases de distance ne se jugent pas à l'œil : le nombre de traces masquées est comparé au fichier de traces (SC-005).

### ✅ La page se vérifie telle qu'on la lit, pas seulement telle qu'elle fonctionne

*Une fonctionnalité présente mais pénible à lire ou mal alignée fait douter l'utilisateur de tout le reste.*

Question à se poser : « si je découvrais cette page, la lirais-je sans effort ? ». On regarde la page entière, à la taille de l'appareil
visé, pas seulement l'élément ajouté.

Exemples :

- ✅ Textes lisibles, éléments alignés, rien qui déborde ni ne se chevauche, sur ordinateur comme sur téléphone.
- ❌ Vérifier que le nouveau filtre fonctionne, sans voir qu'il décale ce qui l'entoure.

### ✅ On se met à la place de l'utilisateur dans ses situations difficiles

*Pour protéger la confiance là où elle se perd vite.*

Cas de bord choisis par risque : (1) sécurité et données personnelles, (2) fausses données (une trace fausse envoie la personne sur un mauvais chemin),
(3) service ou partenaire indisponible (Drive, fond de carte), (4) droits (localisation refusée), (5) valeurs limites (8 km, 10 km). L'utilisateur comprend
ce qui arrive et ce qu'il peut faire. Un cas existe parce qu'un risque réel le justifie, pas pour être exhaustif. Les autres appareils et configurations
concernés sont couverts, ou l'écart est écrit.

Exemples :

- Un parcours de 12 km déposé est rangé avec les « 10 km et plus », et pas parmi les autres chemins (SC-013).
- Sur téléphone, il n'y a pas de survol : la trace s'ouvre au toucher, sans infobulle (SC-008).

### ✅ Les conséquences sur les autres produits sont vérifiées, et ce qui vaut pour l'un est propagé aux produits similaires

*Un changement dans un produit se constate souvent dans un autre, et un problème résolu ici se reposera demain ailleurs.*

- **En amont et en aval** : le parcours liste ce qui est touché et prévoit la vérification croisée, ou dit qu'elle n'est pas faite.
- **Chez les produits similaires** : pour chaque point de contrôle, se demander s'il doit aussi exister dans les produits de même nature ; si oui, l'ajouter
  ou le lier, sinon écrire pourquoi.
- **Pour l'outillage** : un script ou une solution mise en place pour un parcours (appareil simulé, site local avec Drive simulé) est écrit de façon générique
  dès le départ, puis mentionné ou lié là où il peut resservir, pour ne pas reprendre le même problème plus tard.

Exemples :

- Une trace déposée sur le Drive change ce que voient la consultation (P-001) et le téléchargement (P-002) : P-003 le dit et renvoie vers eux.
- `openVariant` (smartphone, site local) et `tests/web/lib/local-site.js` (Drive simulé) sont génériques et décrits dans `README.md`.

### ✅ Le déroulé ne dérange pas la personne qui le lance

*Pour que la recette soit lancée souvent.*

- Une fenêtre réutilisée, pas de fenêtres qui clignotent ; toute fenêtre supplémentaire inévitable est annoncée (smartphone, site local).
- Une connexion par déroulé, réutilisée ; on ne se reconnecte que sur échec constaté (sans objet tant que le site est public).
- Un geste qui exige la personne est annoncé et limité dans le temps.
- Aucune donnée personnelle ni écran de connexion affichés dans la conversation.

### ✅ Le déroulé est rapide, ciblé et corrige seul ce qui est sûr

*Pour que le retour arrive tant qu'il est utile, sans masquer un vrai défaut.*

- Un enchaînement n'existe que s'il y a une dépendance réelle ; le reste se rejoue point par point.
- Un obstacle technique sans effet sur le comportement attendu (sélecteur périmé, chargement lent) se revérifie, se corrige et se note dans le compte rendu,
  sans interrompre.
- Un doute est rapporté « à revérifier » ; on s'arrête et on demande dès que la correction changerait le comportement attendu ou toucherait un
  environnement sensible.

### ✅ Le scénario livre d'un seul tenant : définition, automatisation, sélecteurs, doc

*Pour qu'un commit contienne tout et que le parcours soit rejouable dès le premier jour.*

Dès qu'un scénario est rédigé : proposer immédiatement la spec d'automatisation et les sélecteurs, puis proposer de dérouler le parcours pour les valider.
La doc concernée (`doc/inventaire-pages.md`, `doc/parcours-utilisateurs.md`) est mise à jour dans le même geste, et l'ensemble est commité ensemble après validation.

### ✅ La doc est écrite pour les personas et les métiers

*Pour qu'elle serve de doc utilisateur, pas de journal.*

- Elle se met à la place de la personne et répond à « comment fait-on pour… ».
- Elle est courte : ce qu'un utilisateur doit savoir, rien d'autre.
- Elle ne contient ni résultat de test, ni date, ni historique des modifications (git fait le suivi), ni consigne d'agent.
- Ce qu'on découvre en testant (page, état, règle) y entre, inséré dans le parcours concerné ; ce qui devient faux en sort.

### ✅ La définition dit l'attendu, jamais le résultat

*Pour qu'elle reste valable dans le temps.*

Le résultat va dans le rapport (`outputs/reports/`), le défaut dans un ticket. La définition ne change que si le besoin change, qu'un point manquait ou qu'un
défaut détecté tard demande un point de contrôle. Aucun secret ni donnée réelle dans les fichiers partagés.

## Visuel

> **Avant d'ajouter un point :** Qui ? → Que voit-il ? → Le lit-il sans effort ? → Que perd-il si c'est faux ? → Où le constate-t-on ? → Qui d'autre est touché ?

> **Un scénario terminé :** définition + spec + sélecteurs + déroulé proposé + doc → un commit

Gabarit d'un parcours (voir `config/front/parcours.md`) :

**Parcours — \<action métier>** (\<persona>, \<contexte>)

| Ordre | SC | Point de contrôle (résultat observable) | Bloquant ? | Où le vérifier |
| --- | --- | --- | --- | --- |
| 1 | SC-010 | Le fichier reçu est un GPX exploitable, de la trace choisie | oui | fichier téléchargé |

- **Cas de bord (par risque)** : sécurité · fausses données · indisponibilité · droits · limites
- **Touchés en amont / aval** : \<liste> — vérification croisée : \<faite / non faite>
- **Produits similaires** : \<liste> — propagé / lié / non applicable (pourquoi)

## Instructions pour l'assistant IA

- Relire un parcours avec la grille ; signaler les points sans « ce que l'utilisateur perd ».
- Après rédaction d'un scénario, proposer spec, sélecteurs et déroulé sans attendre qu'on le demande.
- Après un script ou un correctif d'outillage, proposer de le généraliser et de le référencer là où il peut resservir.
- Ne jamais consigner un résultat, une date ou un historique de modification dans la définition ou la doc.
