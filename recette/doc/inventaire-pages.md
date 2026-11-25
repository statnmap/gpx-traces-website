# Inventaire des pages — Référence de développement et de maquettage

Répertoire exhaustif des pages et états du produit, organisé par parcours utilisateur. Document vivant : le
mettre à jour quand une page ou un état nouveau apparaît.

**Colonne « Maquette »**
- **Nouvelle** = layout distinct, 1 maquette dédiée requise
- *Variante* = même template que la ligne en gras au-dessus ; seuls le texte, la couleur ou une info supplémentaire changent — le designer annote la maquette parente, le développeur implémente l'état

> Un designer a besoin des lignes **Nouvelle** uniquement. Un développeur doit implémenter toutes les lignes.

**Conventions**
- Une page = une ligne en gras ; ses états (erreur, vide, chargement...) = lignes en italique juste dessous, marquées *Variante*.
- « URL type » : chemin, jamais d'URL ni d'identifiant réels. Écran sans URL (fenêtre, écran natif) : l'écrire.
- « Périmètre » : où la page existe (`front`) ; « tous » si commune.
- « Éléments clés » : ce que l'utilisateur voit et peut faire — pas de sélecteurs, pas de données de test.
- Une section par grand parcours (Consultation, Téléchargement).

---

## 1. Consultation des traces

| Page / État | URL type | Périmètre | Maquette | Éléments clés |
|---|---|---|---|---|
| **Carte des traces** (page d'accueil, seule page du site) | `/` | front | **Nouvelle** | Titre ; carte interactive avec toutes les traces colorées par catégorie ; cases de catégories (parcours, chemin boueux, chemin inondable, danger, autres) ; cases de distance des parcours ; bouton « Afficher ma position GPS » ; pied de page |
| *Trace survolée (souris)* | `/` | front | *Variante* | Trace en rouge, plus épaisse ; infobulle avec le nom de la trace |
| *Fenêtre d'une trace* | `/` (fenêtre sur la carte) | front | *Variante* | Nom de la trace ; lien « Download GPX » ; croix de fermeture ; trace en rouge tant que la fenêtre est ouverte |
| *Filtre de distance grisé* | `/` | front | *Variante* | Cases de distance grisées quand la catégorie « parcours » est masquée |
| *Case « Distance inconnue »* | `/` | front | *Variante* | Case supplémentaire, affichée seulement si un parcours n'a pas de distance dans son nom |
| *Position GPS affichée* | `/` | front | *Variante* | Repère sur la carte ; bouton devenu « Masquer ma position GPS » |
| *Écran de smartphone* | `/` | front | *Variante* | Même page sur écran tactile : pas d'infobulle au survol, la fenêtre s'ouvre au toucher |

---

## 2. Téléchargement

| Page / État | URL type | Périmètre | Maquette | Éléments clés |
|---|---|---|---|---|
| **Fichier GPX d'une trace** (pas de page : téléchargement) | `/…/{nom-de-la-trace}.gpx` | front | **Nouvelle** | Fichier reçu par l'appareil, nommé d'après la trace, contenant le tracé |
