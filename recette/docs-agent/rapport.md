# Rapport de recette par parcours

Fichier : `outputs/reports/front/AAAA-MM-JJ_HHhMM_parcours.md`. Gitignoré. Jamais d'Artifact ni d'hébergement externe. Une version HTML locale (`node scripts/md-to-html.mjs <rapport>.md`) se propose en fin de recette ; ouverture dans le navigateur seulement après accord.

## Structure

```markdown
# Rapport de recette (mode parcours) — <nom du site>

**Date** : AAAA-MM-JJ HHhMM
**Environnement** : <nom de l'environnement> (pas d'URL complète)
**Scope** : front
**Mode** : recette par parcours

---

## Résumé global

| Statut | Parcours | SC couverts |
|---|---|---|
| ✅ Passé | X | Y |
| ❌ Échoué | X | Y |
| ⛔ Bloqué | X | Y |
| ⏭️ Différé (minuterie) | X | Y |
| ⏭️ N/A | X | Y |
| **Total** | **X** | **Y** |

**Durée totale recette** : Xh YYmin
**Top 3 SC les plus lents** : SC-0xx (2:15), …
**Durée médiane par SC** : ~Xs

---

## Bilan de couverture des SC

| SC | Titre court | Couvert par | Méthode | Résultat | Durée |
|---|---|---|---|---|---|
| SC-001 | Affichage de la carte | P-001 HP1 | Runner autonome | ✅ | 0:18 |
| SC-031 | Filtre par distance | P-001 HP1 | Manuel (MCP) | ❌ | 2:15 |
| SC-034 | Option X | P-002 HP2 | — | ⏭️ N/A | — |

Colonne Méthode : `Runner autonome` (script, sans IA), `Manuel (MCP)` (agent : SKIP, N/A auto-déclaré, plafond de heal), `—` pour les SC `⏭️ N/A`.

**SC non couverts par les fichiers de parcours** : SC présents dans `scenarios.md` mais absents de `parcours.md`.

---

## Bilan de couverture : inventaire des pages (voir plus bas)

---

## [P-001] <titre du parcours>

### Happy path — <libellé> — ✅ / ❌ / ⛔

**Session** : continue, ouverte à SC-001, fermée après SC-031

| Ordre | SC | Résultat | Durée | Checkpoint validé |
|---|---|---|---|---|
| 1 | SC-001 | ✅ | 0:18 | Carte visible avec au moins une trace |
| 2 | SC-031 | ❌ | 2:15 | Filtre appliqué : non, <erreur précise sans donnée sensible> |
| 3 | SC-032 | ⛔ | — | Bloqué, dépend de SC-031 |

**Observations** : détail des échecs.
**Exécution** : SC-001 via le runner autonome ; SC-031, SC-032 en manuel (omettre si une seule méthode).

### Cas de bord

#### SC-012 <titre> — ✅ PASSÉ
**Session** : isolée
**Étapes** : 1. ✅ … 2. ✅ …
**Observations** : conforme.

---

## Sélecteurs mis à jour lors de la recette

Aucun sélecteur corrigé, ou tableau :

| Nom clé | Ancien sélecteur | Nouveau sélecteur | Détecté lors de |
|---|---|---|---|

## Bilan de conformité

| Vérification | Résultat |
|---|---|
| Aucune URL d'environnement en clair | ✅ / ❌ |
| Aucun identifiant, mot de passe, jeton | ✅ / ❌ |
| Aucune capture d'un écran de connexion ou de saisie sensible | ✅ / ❌ |

**Verdict** : ✅ Conforme / ❌ (corriger avant de clore)
```

Une section « Scénarios avec minuterie » n'est ajoutée que si au moins un parcours porte une contrainte de fréquence.

## Couverture de l'inventaire des pages (`doc/inventaire-pages.md`)

Si le fichier est absent : sauter toute cette partie, sans bloquer la recette.

### Chargement (étape 2 du workflow)

Parser les tableaux numérotés de l'inventaire. Dictionnaire `INVENTAIRE_LIGNES` : une entrée par ligne, clé `<numéro de section>|<libellé de la colonne Page / État>`, valeur `{section, url_type, elements_cles[]}` (éléments clés découpés sur les virgules). `INVENTAIRE_COUVERTURE` : mêmes clés, valeur initiale `non testé`. `INVENTAIRE_DECOUVERTES` : liste vide pour les pages ou états rencontrés sans ligne correspondante.

### Alimentation au fil de l'exécution

À chaque page ou état atteint par un SC, **sans navigation, capture ni inspection supplémentaire** : réutiliser l'inspection déjà faite pour le checkpoint (ou, pour un SC du runner, le seul résultat pass/fail avec l'annotation `(éléments non vérifiés en détail)`).

1. **Identifier la ligne** : comparer le chemin d'URL (sans domaine ni query string) à la colonne « URL type » ; écran sans URL : comparer le libellé à « Page / État ». Aucune ligne ne convient : ajouter à `INVENTAIRE_DECOUVERTES` `{section probable, libellé, url ou écran, éléments observés}`, uniquement pour un état de premier plan visité délibérément.
2. **Vérifier chaque élément clé** à partir de l'inspection déjà faite. Dresser la liste des éléments manquants. Si le checkpoint n'a demandé aucune lecture du DOM, statuer présent/absent avec `(éléments non vérifiés en détail)`.
3. **Mettre à jour `INVENTAIRE_COUVERTURE[clé]`** : `✅` (tous les éléments clés trouvés) ; `✅ (⚠️ manquant : X, Y)` ; `❌ (raison courte)` (page confirmée absente alors qu'attendue) ; `— non testé cette recette` (valeur par défaut, **jamais transformée en ❌**). Ne jamais écraser un statut déjà positionné par `non testé` ; fusionner en cas d'observations complémentaires.

### Section du rapport

Reproduire fidèlement, dans l'ordre, les tableaux de l'inventaire (mêmes titres `### N. Titre`, mêmes lignes) avec une colonne finale `Présent` remplie depuis `INVENTAIRE_COUVERTURE`. En pied de section, si `INVENTAIRE_DECOUVERTES` n'est pas vide :

| Page/état observé | Section probable | Éléments observés |
|---|---|---|

### Mise à jour de l'inventaire

Si `INVENTAIRE_DECOUVERTES` n'est pas vide : proposer la mise à jour de `doc/inventaire-pages.md` à l'utilisateur, **sans jamais modifier le fichier avant son accord**, et sans commit ni push avant confirmation séparée. Le périmètre est strictement `doc/inventaire-pages.md`.

## Confidentialité

Ne jamais écrire dans le rapport : numéro de carte, identifiant, mot de passe, jeton, URL complète d'environnement, nom d'utilisateur réel. Relire le rapport avant de le clore ; corriger tout ❌ du bilan de conformité immédiatement.
