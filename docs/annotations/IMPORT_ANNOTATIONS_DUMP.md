# Import d'annotations — format « dump »

> Note : ce document est rédigé en français, mais tout ce qui relève du modèle
> de données reste en anglais (types, clés JSON, schéma).

L'outil **Import annotations** (`IMPORT_ANNOTATIONS`, panneau de droite) accepte
trois formats, distingués automatiquement au collage :

| Format | Discriminant | Producteur |
|---|---|---|
| JSON inline | `image` + `annotationTemplates` | [`IMPORT_FROM_DRAWING_PROMPT.md`](IMPORT_FROM_DRAWING_PROMPT.md), skill `structure-outline` |
| Maillage | `kind: "MESH"` ou `meshes` | [`MESH_IMPORT_PROMPT.md`](MESH_IMPORT_PROMPT.md) |
| **Dump** | `imageSize` + `annotations` | bouton debug 🐛 de la barre d'outils de sélection |

Ce document décrit le troisième.

## Aller-retour

1. Sélectionner des annotations sur le plan.
2. Dans la barre d'outils multi-sélection, cliquer le bouton 🐛
   « Copy annotations data » (`ToolbarEditAnnotations`) → le JSON part dans le
   presse-papier.
3. Coller dans le champ de l'outil **Import annotations**.
4. « Ajouter au fond de plan » → les annotations sont recréées sur le fond de
   plan courant.

Le dump est le format de sortie de `useAnnotationsV2` : ce sont les lignes
**hydratées**, pas les lignes brutes de la base.

```jsonc
{
  "imageSize": { "width": 4725, "height": 2362 },
  "meterByPx": 0.0127,
  "annotations": [
    {
      "id": "wZ28HE_xm41eSMOt4JxqJ",
      "type": "STRIP",
      "annotationTemplateId": "neooIWLFs6p0JKcsFm4Aq",
      "label": "Mur béton ext",
      "height": 2.5, "material3d": "BETON", "isExt": true, "closeLine": true,
      "points": [
        { "id": "RY7jb0RRhuql-z5T6HDNP", "x": 1187.31, "y": 589.918,
          "type": "square", "offsetBottom": 0, "offsetTop": 0 }
      ],
      "annotationTemplateProps": { "label": "Mur béton ext", "strokeWidth": 20 }
    }
  ]
}
```

## Trois particularités

### 1. Coordonnées en pixels

Contrairement au JSON inline (normalisé `[0..1]`), les `points` du dump sont en
**pixels** du fond de plan source. `normalizeAnnotationsDumpJson` les divise par
`imageSize` pour rejoindre la forme interne.

`meterByPx` donne l'échelle : `image.widthMeters = meterByPx * imageSize.width`
est dérivé automatiquement, l'utilisateur n'a pas à saisir la largeur en mètres.

### 2. Pas de tableau `annotationTemplates`

Chaque annotation embarque `annotationTemplateProps`, qui est la projection
complète de la ligne de template (`getAnnotationTemplateProps`). Le tableau de
templates est donc **synthétisé** à l'import, un par `annotationTemplateId`
distinct.

`annotationTemplateId` est un **vrai id de base**, d'où la règle de
`resolveImportTemplatesService` :

- ligne vivante du **même projet** → réutilisée telle quelle (un aller-retour
  copier / ré-importer ne duplique pas le template) ;
- ligne soft-deleted, ou appartenant à un autre projet → un template neuf est
  créé avec un id neuf ;
- ligne absente → créée **en conservant l'id source**, ce qui rend un second
  import de la même charge utile idempotent.

Le panneau affiche « existant » / « à créer » par template avant l'import.

> `annotationTemplateProps` est un instantané **render-time**. Il sert seulement
> à reconstruire le template et n'est **jamais** persisté sur l'annotation (voir
> `useChangeAnnotationTemplate`).

### 3. Les ids de points sont partagés — et le restent

Un même id de point apparaît dans plusieurs annotations quand les géométries
sont **soudées** (jonction de murs en T, refend qui part d'un contour). Ces
soudures portent toute la topologie exploitée par les parois automatiques,
l'ancrage des ouvertures ou le cuvelage.

L'import conserve ces soudures : chaque id source est porté jusqu'à
`pasteAnnotationService` sous la clé `sourceId`, et une `Map` locale au batch
garantit **une seule ligne `db.points` par id source**, partagée par toutes les
annotations qui le référencent.

C'est un opt-in : le presse-papier du copier/coller de l'éditeur ne pose pas de
`sourceId`, son comportement est inchangé (un point neuf par occurrence).

## Périmètre

Couvert :

| Famille | Types | Géométrie |
|---|---|---|
| `points` | POLYLINE, POLYGON, STRIP, COTE, RULER | `points` + `cuts` (trous de polygone) |
| `point` | POINT, MARKER, DETAIL | `point` |

Ces listes reflètent exactement ce que `pasteAnnotationService` sait cloner.
Tout autre type est **ignoré** et signalé dans le panneau — un dump d'une
sélection mixte reste importable.

Non couvert : `guideLines`, `isoHeightLines`, `profileLines` (leurs références
utilisent la clé `pointId` et non `id`), ainsi que `entityId` et `layerId`.

## Champs conservés

Le JSON inline filtre les styles par une **allowlist** (`importStyleFields.js`).
Le dump fait l'inverse : il expédie des lignes complètes, et
`normalizeAnnotationsDumpJson` les nettoie par **denylist**. Tout ce qui n'est ni
une donnée hydratée, ni un champ d'identité / d'audit est repris tel quel —
`height`, `offsetZ`, `color3D`, `opacity3D`, `material3d`, `isExt`,
`hiddenInLegend`, `overrideFields`, `stripOrientation`, et tout champ futur.

Sur les points, `type` (`"circle"` = point de contrôle d'arc) et les décalages Z
`offsetTop` / `offsetBottom` vivent sur la **référence inline**, jamais sur la
ligne `db.points` (voir [`POINTS_STORAGE.md`](POINTS_STORAGE.md)). Ils ne sont
repris que lorsqu'ils diffèrent des valeurs par défaut appliquées à la lecture
par `resolvePoints` (`"square"` / `0` / `0`).

## Positionnement

La case « Positionner par rapport au fond de plan » (active par défaut) mappe les
coordonnées normalisées directement sur l'espace pixel du fond de plan cible :
sur le plan d'origine, l'import se superpose exactement à la sélection copiée.

Décochée, l'échelle réelle est utilisée (`widthMeters` / `meterByPx` du fond de
plan cible) et le groupe se pose au clic suivant sur la carte.

## Limites connues

- L'écriture passe par `db.annotations.bulkAdd` (via `pasteAnnotationService`),
  qui court-circuite `createAnnotationService` : les `sortedAnnotationIds` de la
  liste cible ne sont pas mis à jour. Pré-existant sur tous les chemins de
  collage.
- Les lignes `relAnnotationMappingCategory` de la source sont clonées quand
  l'import a lieu dans le projet d'origine (les ids sources y existent encore).
