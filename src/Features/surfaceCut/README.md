# surfaceCut — « Couper une surface » (éditeur 2D)

Commande du panneau « Outils de dessin » du module Dessin, dans l'éditeur 2D uniquement. Un trait de coupe découpe une ou plusieurs surfaces (annotations `POLYGON`) en autant d'annotations que de morceaux.

Deux variantes :

- **Segment (2 clics)**, clé `SURFACE_CUT_SEGMENT`.
- **Polyligne clic**, clé `SURFACE_CUT_POLYLINE`.

Quand la surface est une annotation maillée (`isMesh3d`), la coupe se fait en **guillotine verticale**. Le « rideau » vertical posé sur le trait coupe toutes les faces du maillage. Chaque côté devient une annotation maillée fermée : les faces de coupe sont ajoutées.

## Utilisation

| Action                                                                          | Effet                                                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Ligne « Couper une surface » du panneau, ou touche **F** (hors dessin en cours) | Arme l'outil, avec la dernière variante utilisée (segment par défaut). |
| Barre du bas, ou **Tab**                                                        | Bascule entre segment et polyligne.                                    |
| Segment : 2e clic                                                               | Coupe.                                                                 |
| Polyligne : **Entrée**                                                          | Coupe.                                                                 |
| **Échap** pendant le trait                                                      | Annule le trait **sans couper**, comme la « Coupe face » 3D.           |
| **Échap** sans trait                                                            | Quitte l'outil.                                                        |

L'outil reste armé après une coupe. L'aimantation (sommets, arêtes) et l'ortho (Maj) fonctionnent comme pour une polyligne. La touche T (arc) est sans effet : le trait est toujours droit, segment par segment.

## Règles (décisions de la V1)

- **Cible** : si des surfaces sont sélectionnées au moment de la coupe, seules elles sont coupées. Sinon, toutes les surfaces visibles que le trait traverse sont coupées.
  - Les surfaces en lecture seule sont ignorées : scope en lecture seule, liste liée d'un autre scope, annotation d'un autre auteur.
  - Sont aussi ignorés les contours étrangers (`isForeignFootprint`) et les anciennes mailles (`isMeshCell`).
- **Prolongement (guillotine)** : une extrémité du trait arrêtée à l'intérieur d'une surface est prolongée dans la direction de son dernier segment jusqu'au premier bord. Un segment court tracé dans la surface suffit donc pour la couper de part en part. Une extrémité sur le bord ou à l'extérieur est prise telle quelle.
- **Un morceau = une annotation** : un trait qui traverse plusieurs fois une surface (forme en L ou en U, polyligne en zigzag) donne plus de 2 morceaux.
  - Le plus grand morceau (aire en plan) **garde l'annotation d'origine** : son id, ses relations (zones, objets métier, lots…), ses lignes guides / courbes de niveau / profils.
  - Les autres morceaux sont créés avec les champs de l'original. Ils reçoivent un nouveau numéro si la liste numérote automatiquement.
- **Trous** : un trou traversé par le trait est réparti entre les morceaux, il devient une encoche. Un trou intact suit le morceau qui le contient et garde sa ligne `cuts[i]` telle quelle.
- **Une seule annulation** : Ctrl+Z défait toute la coupe, toutes les surfaces comprises (`withUndoGroup`). Comme pour tout outil 2D, Ctrl+Z pendant que l'outil est armé retire d'abord le dernier point : il faut quitter l'outil pour annuler une coupe.
- **Refus** (message, sans écriture) : trait qui ne traverse aucune surface, trait qui se recoupe, surface tournée, hôte d'ouvertures ou de soustractions, extrémité de coupe sur un arc de cercle.

## Architecture

### Câblage UI

Les deux outils **empruntent** les modes d'interaction `POLYLINE_SEGMENT` et `POLYLINE_CLICK` via `drawingMode` (même procédé que `CUT_POLYLINE` ou `RULER_SEGMENT`). Ainsi `InteractionLayer` n'a pas besoin d'un nouveau mode : clics, aperçu, aimantation, Entrée et ortho viennent gratuitement.

Le brouillon garde le **pseudo-type** `SURFACE_CUT` (`newAnnotation.type`). C'est lui qui identifie le groupe, puisque `enabledDrawingMode` vaut `POLYLINE_*` et ne permet pas de remonter au groupe (`getDrawingToolTypeByKey` renvoie null).

| Fichier                                                | Rôle                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mapEditor/constants/drawingTools.jsx`                 | Outils `SURFACE_CUT_SEGMENT` / `SURFACE_CUT_POLYLINE`, groupe `DRAWING_TOOLS_BY_TYPE.SURFACE_CUT`.                                                                                                                                                      |
| `mapEditor/constants/toolItems.js`                     | Ligne `{ type: "SURFACE_CUT", label: "Couper une surface", Icon: IconCutSurface, shortcut: "F", editor: "2D" }`. Elle apparaît dans `SectionPanelDrawingTools` et `PopperMapListings`.                                                                  |
| `surfaceCut/utils/surfaceCutTools.js`                  | `SURFACE_CUT_TOOL_TYPE`, `isSurfaceCutDraft(newAnnotation)`.                                                                                                                                                                                            |
| `mapEditor/utils/buildToolDraft.js`                    | Style du trait (`SURFACE_CUT_COLOR`, 2 px plein) et retrait de `drawingShape`, pour que l'aperçu et les raccourcis n'héritent pas d'une forme précédente.                                                                                               |
| `mapEditor/utils/getDraftFieldVisibility.js`           | Reconnaît le groupe par le type du brouillon (`toolGroupType: "SURFACE_CUT"`), ce qui masque les champs Offset / Hauteur / épaisseur.                                                                                                                   |
| `mapEditor/components/ToolbarDrawingDraft.jsx`         | Bascule segment / polyligne, surbrillance via `selectedToolKeyByTemplateId.SURFACE_CUT`.                                                                                                                                                                |
| `mapEditor/hooks/useDrawingToolHotkeys.js`             | Tab alterne les deux variantes (`switchTool(..., { groupType })`).                                                                                                                                                                                      |
| `mapEditor/components/MainMapEditorV3.jsx`             | `useToolGroupHotkey("f", "SURFACE_CUT")`. Dans `onCommitDrawing`, la branche `type === SURFACE_CUT_TOOL_TYPE` est placée **avant** les autres : sans elle, `useHandleCommitDrawing` enregistrerait le trait comme une annotation de type `SURFACE_CUT`. |
| `mapEditor/components/InteractionLayer.jsx`            | Deux gardes : Échap vide le trait sans `commitInProgressDrawing` ; T (arc) est sans effet.                                                                                                                                                              |
| `mapEditor/components/SectionDrawingHelperContent.jsx` | Bandeau d'aide, liste de raccourcis `SURFACE_CUT_SHORTCUTS`. Cartes « Détection auto » et « Offset par défaut » masquées.                                                                                                                               |

### Hook — `hooks/useHandleSurfaceCutCommit.js`

`useHandleSurfaceCutCommit({ annotations, selectedNodes })` renvoie `handleSurfaceCutCommit(points)` :

1. Choisit les candidats : les `POLYGON` sélectionnés, sinon les `POLYGON` affichés dont la boîte englobante touche celle du trait. La liste `annotations` est celle de `MainMapEditorV3` : `useAnnotationsV2` en a déjà retiré les modèles masqués.
2. Filtre l'éditable : `useReadOnlyScope`, puis `useAnnotationPermissions().canEditAnnotation(id, { silent: true })`.
3. Convertit le trait de pixels en coordonnées normalisées (`x / width`, `baseMap.getImageSize()`, comme `useHandleCommitDrawing`).
4. Appelle le service et affiche un toaster en français si rien n'est coupé, avec la raison la plus parlante.

### Service — `services/cutSurfaceAlongPathService.js`

`cutSurfaceAlongPathService({ annotationIds, path, projectId, dispatch, createAnnotationFn, updateAnnotationFn })` → `{ cutCount, pieceCount, reason }`.

- **Planifie d'abord, écrit ensuite** : chaque surface est d'abord calculée sans écriture (`planPolygonCut` / `planMeshCut`). Ensuite, toutes les écritures passent dans **un seul** `withUndoGroup`.
- Calcul en mètres locaux du fond de plan : `getMesh3dMetrics` (repli `meterByPx` 0,01 sans échelle), `normalizedToLocal` / `localToNormalized`. Tolérance de plan : 1 cm (`PLAN_TOL_M`).
- `reason` (`SURFACE_CUT_REASONS`, de la moins à la plus parlante) : `NO_CROSSING`, `NOT_THROUGH`, `SELF_INTERSECTING`, `ARC`, `ROTATED`, `HOST`, `NOT_EDITABLE`, `FAILED`.
- **Pièces peintes** (« Pinceau », `meshPaint`) : après les écritures, `copyMeshPaintsForSplit({ sourceHostId, newHostIds, metrics })` les répartit sur les morceaux.

**Surface classique** (`planPolygonCut`) :

1. Résout les anneaux depuis `db.points` : contour et trous, points orphelins ignorés comme au rendu.
2. Calcule les tronçons du trait dans la surface (`getPathChunksInRegion`, avec `extendEnds`), puis découpe (`splitFlatRegionAlongChunks`).
3. Sommets : un sommet d'origine garde sa référence (id, type, offsets). Un nouveau sommet devient un nouveau `db.points`, **partagé** par les morceaux qui le touchent. Ses `offsetBottom` / `offsetTop` sont interpolés sur l'arête d'origine (`lerp`), ou ajustés sur le plan du contour (`fitPlanarValue`) pour un point intérieur.
4. **Drapeaux de segments** (`hiddenSegmentsPointIds` et les 3 autres) : un segment de morceau posé sur un segment d'origine marqué garde la marque. Les champs `...Idx` hérités sont vidés (règle « migrate-on-write » de `segmentFlags.js`).
5. `innerPoints` (points de Steiner) : chacun va au morceau qui le contient.
6. `guideLines` / `isoHeightLines` / `profileLines` restent sur le morceau principal et sont vidés sur les nouveaux, pour ne jamais partager d'ids de points.

**Annotation maillée** (`planMeshCut`) :

1. `loadStoredMesh3d` (base seule, pas besoin de l'éditeur 3D), puis `splitMesh3dAlongVerticalPath`.
2. Le morceau principal passe par `writeMesh3dService`. Son `mesh3dSource` est **retiré** : « Réinitialiser » referait l'objet entier par-dessus les autres morceaux.
3. Chaque autre morceau : `buildMesh3dStorage` (nouveaux points écrits `withoutUndo`, comme `createFlatMesh3dAnnotationService`), puis `createAnnotationFn({ ...getSplitPieceProps(kept), type: "POLYGON", isMesh3d: true, height: 0, mesh3d, offsetZ, points, cuts })`, sans `mesh3dSource`.

### Utilitaires purs — `utils/`

Imports relatifs en `.js`, testables sous node.

- **`getPathChunksInRegion(loops, path, { tolerance, extendEnds })`** → `{ chunks, path }` ou `{ error }`.
  - `loops` = `[contour, ...trous]`.
  - Le trait est découpé à chaque croisement avec un bord. On garde les **tronçons** strictement intérieurs, bornés aux deux bouts sur un bord. Une extrémité de tronçon à moins de `tolerance` d'un sommet devient ce sommet.
  - Les tronçons qui longent un bord (« lamelles ») sont écartés.
  - Exporte aussi `extendPathEnds`, `isPathSelfIntersecting`, `isInsideRegion`, `signedArea2d`, `intersectSegments`.
- **`splitFlatRegionAlongChunks(loops, chunks)`** → `{ vertices, faces }` ou null.
  - La région devient un maillage plat à une face, découpé tronçon par tronçon avec le découpeur de faces du maillage (`splitMesh3dFaceDetailed`). Ce découpeur n'ajoute que des sommets : les indices `0..n-1` restent les sommets d'origine.
  - Un tronçon contour → trou fusionne les deux boucles (« trou de serrure »). Le tronçon suivant, du trou vers le contour, coupe la région.
  - Renvoie null s'il reste une fente (tronçon vers un trou non refermé) ou moins de 2 faces.
  - C'est le moteur **unique** du plan et du découpage des faces de coupe.
- **`splitMesh3dAlongVerticalPath(mesh, path, { tolerance })`** → `{ pieces, capped }` ou `{ error }`. Voir ci-dessous.
- **`getSplitPieceProps(annotation)`** : champs copiés sur un nouveau morceau. C'est une copie de la règle de `threedFaceCut` : ce service était modifié en parallèle par le travail `meshPaint`, l'extraction commune est à faire plus tard.

### Guillotine verticale (`splitMesh3dAlongVerticalPath`)

Repère local : x, y = plan, z = haut.

1. **Rideau** :
   - Silhouette en plan du maillage (`projectMesh3dToRings`).
   - Prolongement des extrémités intérieures jusqu'à son bord, puis dépassement de 1 cm (`OVERSHOOT_M`) pour que chaque face voie les extrémités dehors.
   - `NO_CROSSING` si le rideau ne traverse pas la silhouette.
2. **Tracés par face**, calculés sur les faces d'origine :
   - Face inclinée : la polyligne du rideau est remontée sur le plan de la face, puis on garde ses tronçons dans la face.
   - Face verticale (`|n.z| ≤ 1e-6`) : une verticale à chaque croisement de sa trace en plan avec le rideau.
   - Face parallèle et confondue avec un panneau : aucun tracé.
3. **Impression** : `splitMesh3dFaceDetailed`, limité à la « famille » de la face d'origine (la face garde son index, ses morceaux sont ajoutés en fin de liste). Un sommet inséré sur une arête l'est aussi chez la face voisine : pas de jonction en T.
4. **Séparation** :
   - Arête de coupe = ses deux extrémités et son milieu sont sur le rideau (≤ 0,1 mm en plan).
   - Les faces restent ensemble à travers toute arête qui n'est pas de coupe (union-find).
   - Une face posée sur le rideau suit une voisine.
   - Moins de 2 composantes → `NOT_THROUGH`.
5. **Bouchage** (si le maillage d'entrée est fermé, `isMesh3dClosed`) :
   - Les demi-arêtes de bord de chaque composante (des arêtes de coupe) sont inversées puis chaînées en boucles, pour que la normale soit sortante.
   - Les boucles sont dépliées sur le rideau en (s = abscisse curviligne, z), puis imbriquées : profondeur paire = contour, impaire = trou.
   - Elles sont découpées aux jonctions de panneaux (`s = s_k`, via `splitFlatRegionAlongChunks`) pour que chaque face de coupe reste plane.
   - Retour en 3D ; les sommets de jonction sont soudés au µm.
   - Une chaîne qui ne se ferme pas (maillage ouvert) → pas de bouchage, `capped: false`.
6. `cleanupMesh3d` par morceau ; les morceaux sont triés par aire en plan décroissante.

## Pièges

- **Ne pas enregistrer le trait** : toute nouvelle branche de `onCommitDrawing` doit rester après celle de `SURFACE_CUT`.
- **Groupe reconnu par le brouillon, pas par le mode** : `enabledDrawingMode` vaut `POLYLINE_*`. Utiliser `isSurfaceCutDraft(newAnnotation)` et `selectedToolKeyByTemplateId.SURFACE_CUT`.
- **Tolérances** :
  - Le découpeur de faces classe « sur le bord » à 1 mm (`ON_BOUNDARY_TOL_M`).
  - `getPathChunksInRegion` doit utiliser une tolérance **≥ 1 mm**, sinon un point intérieur du trait trop proche d'un bord casse les tronçons.
  - Le service travaille à 1 cm (`PLAN_TOL_M`).
- **Points des maillages** : toujours de nouveaux `db.points`, jamais réutilisés (règle de `writeMesh3dService`).
- **Toute réécriture de coordonnées d'un maillage** doit aussi traiter `mesh3d` (et `mesh3dSource`) ; voir `commitWrapperTransform`.
- **Tracés de face calculés sur la géométrie d'origine** : après une impression, une face garde son index et ses morceaux sont ajoutés en fin de liste. Ne pas compacter le maillage entre deux impressions.

## Limites V1

- Pas de boucle fermée (« trou + polygone intérieur ») en 2D ; la « Coupe face » 3D le fait.
- Pas de coupe sur un arc de cercle (points S-C-S), donc pas de dalle ronde.
- Surfaces tournées (`rotation`) et hôtes d'ouvertures / soustractions refusés.
- Les rattachements (zones, objets métier, lots, catégories) restent sur le morceau principal.
- Le nouveau sommet n'est pas inséré dans les polygones voisins qui partagent l'arête coupée.
- Un maillage ouvert est coupé sans bouchage.
- La détection automatique est masquée pendant l'outil. Si elle était déjà active avec un autre outil au moment de basculer depuis le panneau, elle reste active.

## Tests

```bash
node --test src/Features/surfaceCut/utils/surfaceCut.test.mjs
```

16 cas :

- **Plan** : rectangle, prolongement, U (3 morceaux), trou traversé, trou intact, passage par un sommet, trait qui se recoupe, fente.
- **Maillage** : boîte coupée par un plan, trait court intérieur, rideau en L, passage par deux arêtes verticales, rideau hors maillage, feuille ouverte, dalle percée, dessus incliné. Chaque cas vérifie que les morceaux sont fermés et que leurs volumes sont conservés.
