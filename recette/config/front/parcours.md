# Parcours de recette — Front

Ce fichier définit les parcours fonctionnels pour la recette par parcours (`node runner/run-recette.mjs --parcours=P-xxx`).
Chaque parcours part d'un besoin (qui, pour obtenir quoi) et regroupe des scénarios de `config/front/scenarios.md` en flux continus
(happy paths) et en vérifications de branches d'erreur (cas de bord).

**Session continue** = une seule session navigateur, ouverte au premier SC et fermée après le dernier. Si un checkpoint
`Bloquant : oui` échoue → les SC suivants du même happy path sont marqués `⛔ BLOQUÉ` dans le rapport (ils restent listés). Le happy
path suivant est quand même exécuté. **Session isolée** = contexte navigateur isolé pour ce SC uniquement (cas de bord à état propre) ;
à ne déclarer que si l'état propre est nécessaire : cela ouvre une fenêtre de plus.

Format d'un parcours (les titres exacts sont lus par le runner — ne pas les renommer) :

    ## [P-NNN] Titre du parcours
    **Priorité** : haute | moyenne | basse
    **Catégorie** : ...
    **Besoin** : <persona, contexte> — <valeur recherchée>

    ### Happy path — <nom>
    **Session** : continue (<de quoi à quoi>)      ← ou « isolée » pour tout le happy path

    | Ordre | SC | Checkpoint | Bloquant ? | Où le vérifier |

    ### Cas de bord
    | SC | Description courte | Session isolée | Ordre recommandé |

    - **Touchés en amont / aval** : <liste> — vérification croisée : <faite / non faite>
    - **Produits similaires** : <liste> — propagé / lié / non applicable (pourquoi)

`Ordre recommandé` : `—`, `avant SC-xxx` ou `après SC-xxx` (position relative dans le même parcours). `Checkpoint` : un résultat que la
personne observe (détail et impact dans `scenarios.md`). `Où le vérifier` : écran, fichier téléchargé, ou le lieu où l'écran ne prouve pas la valeur.

Particularité de ce projet : le moins de fenêtres possible. Tout est en session continue : l'écran d'ordinateur est la session principale ; le
smartphone (écran tactile simulé) et le site local n'ouvrent chacun qu'une seule fenêtre, annoncée au moment de son ouverture et réutilisée par
tous les scénarios qui en ont besoin. Les scénarios restent indépendants : chacun recharge la page, sans compter sur l'état laissé par un autre.
SC-012 et SC-013 jouent sur une copie locale du site (Drive simulé), le reste sur le site de `RECETTE_URL`.

---

## [P-001] Consultation directe des traces
**Priorité** : haute
**Catégorie** : consultation
**Besoin** : une personne qui prépare une sortie à pied ou à vélo (sur ordinateur à la maison, sur téléphone en route) — trouver la trace qui lui convient

### Happy path — Écran d'ordinateur
**Session** : continue (de l'ouverture de la carte au tri par catégorie)

| Ordre | SC | Checkpoint | Bloquant ? | Où le vérifier |
|-------|----|------------|------------|----------------|
| 1 | SC-001 | La carte affiche toutes les traces et les filtres | oui | écran |
| 2 | SC-002 | Survoler une trace en donne le nom et la met en évidence | non | écran |
| 3 | SC-003 | Cliquer une trace ouvre sa fenêtre (nom, téléchargement) et la referme | non | écran |
| 4 | SC-004 | Chaque filtre de catégorie masque exactement ses traces | non | écran, comparé au fichier de traces |

### Happy path — Smartphone
**Session** : continue (de l'ouverture de la carte à l'appui sur une trace)

| Ordre | SC | Checkpoint | Bloquant ? | Où le vérifier |
|-------|----|------------|------------|----------------|
| 1 | SC-007 | La carte est utilisable sur un téléphone, avec toutes les traces | oui | écran (tactile simulé) |
| 2 | SC-008 | Toucher une trace ouvre sa fenêtre, sans infobulle | non | écran (tactile simulé) |

### Cas de bord
| SC | Description courte | Session isolée | Ordre recommandé |
|----|--------------------|----------------|------------------|
| SC-005 | Filtres de distance des parcours | non | après SC-004 |
| SC-006 | Position GPS affichée puis masquée | non | — |
| SC-009 | Filtre de catégorie au toucher | non | après SC-008 |
| SC-014 | Fichier de traces indisponible | non | — |
| SC-015 | Localisation refusée | non | après SC-006 |

- **Cas de bord (par risque)** : droits (localisation autorisée SC-006, refusée SC-015) · indisponibilité (fichier de traces, SC-014) · limites (classes
  de distance, SC-005). Non couverts à ce jour : fichier de traces illisible (contenu invalide), distances exactement à 8 km et 10 km, trace sans distance.
- **Touchés en amont / aval** : le Drive et la publication des traces (P-003) — vérification croisée : faite sur un Drive simulé seulement.
- **Produits similaires** : aucun autre site de traces dans ce dépôt — non applicable.

---

## [P-002] Téléchargement du GPX
**Priorité** : haute
**Catégorie** : téléchargement
**Besoin** : la même personne, une fois sa trace choisie — l'emporter dans son appareil de navigation ou son téléphone

### Happy path — Écran d'ordinateur
**Session** : continue (de la trace choisie au fichier reçu)

| Ordre | SC | Checkpoint | Bloquant ? | Où le vérifier |
|-------|----|------------|------------|----------------|
| 1 | SC-010 | Le fichier reçu est un GPX exploitable, de la trace choisie | oui | fichier téléchargé (nom, contenu, premier point) |

### Happy path — Smartphone
**Session** : continue (de la trace choisie au fichier reçu)

| Ordre | SC | Checkpoint | Bloquant ? | Où le vérifier |
|-------|----|------------|------------|----------------|
| 1 | SC-011 | Le fichier reçu sur un téléphone est un GPX exploitable, de la trace choisie | oui | fichier téléchargé (nom, contenu, premier point) |

- **Cas de bord (par risque)** : aucun couvert à ce jour (fichier supprimé du serveur, nom avec caractères spéciaux).
- **Touchés en amont / aval** : le traitement des GPX qui produit les fichiers servis (P-003) — vérification croisée : faite sur un Drive simulé seulement.
- **Produits similaires** : non applicable (un seul site de traces).

---

## [P-003] Dépôt d'une trace sur le Drive (site local, Drive simulé)
**Priorité** : haute
**Catégorie** : publication
**Besoin** : la personne qui entretient les traces (dépose les fichiers GPX sur le Drive) — rendre une nouvelle trace visible et téléchargeable sur le site

### Happy path — Une nouvelle trace apparaît
**Session** : continue (du dépôt à la trace téléchargée)

| Ordre | SC | Checkpoint | Bloquant ? | Où le vérifier |
|-------|----|------------|------------|----------------|
| 1 | SC-012 | La trace déposée apparaît sur le site, s'ouvre et se télécharge ; les autres sont inchangées | oui | écran, fichier de traces publié, fichier téléchargé |

### Cas de bord
| SC | Description courte | Session isolée | Ordre recommandé |
|----|--------------------|----------------|------------------|
| SC-013 | Trace « parcours » classée selon sa distance | non | après SC-012 |

- **Cas de bord (par risque)** : limites (distance annoncée dans le nom, SC-013). Non couverts à ce jour : fichier GPX invalide, doublon de nom, nom à
  caractères spéciaux, Drive indisponible.
- **Touchés en amont / aval** : le vrai Drive et le déclenchement automatique de la publication ne sont **pas** couverts (Drive simulé, traitement
  de l'application rejoué à la main) — vérification croisée : non faite. En aval : la consultation et le téléchargement (P-001, P-002).
- **Produits similaires** : non applicable.
