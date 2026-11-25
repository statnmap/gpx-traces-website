# Sélecteurs validés — Front

**Dernière mise à jour** : 2026-11-25 (source : lecture du code de l'application, à confirmer au premier run)

Ce fichier est la seule source des sélecteurs : les specs les lisent par nom-clé (`getSelector(selectors, 'cle')`),
jamais en dur. Quand un sélecteur casse, le runner s'arrête (code 2) et Claude répare **la ligne concernée ici**
(heal), puis relance avec `--resume`. Préférer un sélecteur stable (attribut, rôle, texte) à une classe générée.

Seule la table « Sélecteurs CSS » ci-dessous est lue par le runner pour les specs et le heal (colonnes `Nom clé` et
`Sélecteur CSS`) ; la section « Masquer aux captures » n'est lue que par `session.capture()`.

## Sélecteurs CSS

| Nom clé                  | Sélecteur CSS                              | Page / URL | Validé le  | Notes |
|--------------------------|---------------------------------------------|------------|------------|-------|
| accueil-titre            | `h1`                                        | accueil    | 2026-11-25 | titre « Traces GPX à télécharger » |
| carte                    | `#mapcontent.leaflet-container`             | accueil    | 2026-11-25 | conteneur de la carte (Leaflet initialisé) |
| carte-panneau            | `#mapcontent .leaflet-pane`                 | accueil    | 2026-11-25 | volet de la carte ; position absolue si les styles Leaflet sont chargés |
| trace                    | `#mapcontent path.leaflet-interactive`      | accueil    | 2026-11-25 | une ligne par trace visible ; l'ordre suit celui du fichier de traces |
| infobulle                | `.leaflet-tooltip`                          | accueil    | 2026-11-25 | nom de la trace au survol (souris seulement) |
| popup                    | `.leaflet-popup`                            | accueil    | 2026-11-25 | fenêtre ouverte au clic ou au toucher d'une trace |
| popup-fermer             | `.leaflet-popup-close-button`               | accueil    | 2026-11-25 | croix de fermeture de la fenêtre |
| popup-telechargement     | `.leaflet-popup a[download]`                | accueil    | 2026-11-25 | lien « Download GPX » de la fenêtre |
| filtre-categorie         | `input[name="category"]`                    | accueil    | 2026-11-25 | une case par catégorie ; cibler une case avec `[value="parcours"]` |
| filtre-distance          | `input[name="distance"]`                    | accueil    | 2026-11-25 | une case par classe de distance ; `[value="lt8"]`, `8to10`, `gte10`, `unknown` |
| filtres-distance         | `#distance-filters`                         | accueil    | 2026-11-25 | bloc des distances ; classe `disabled` quand les parcours sont masqués |
| distance-inconnue        | `#distance-unknown`                         | accueil    | 2026-11-25 | case « Distance inconnue », affichée seulement si un parcours n'a pas de distance |
| bouton-gps               | `#add-gps-position`                         | accueil    | 2026-11-25 | bascule « Afficher / Masquer ma position GPS » |
| marqueur-gps             | `.leaflet-marker-icon`                      | accueil    | 2026-11-25 | repère de la position de l'utilisateur |

## Masquer aux captures

Éléments masqués pendant `session.capture(id, slug)` (captures de preuve), et pendant elles seulement : `visibility:hidden`
(les nœuds restent présents), restauré après la capture. À renseigner pour tout habillage qui n'est pas l'objet du test
(bandeau de cookies, widget de chat, barre de debug). Une puce par élément : sélecteur CSS entre apostrophes inversées, puis
la raison. Section vide ou absente : rien n'est masqué.

_(Aucun pour l'instant : la page n'a ni bandeau ni widget.)_
