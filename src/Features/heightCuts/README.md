# heightCuts — découpes de hauteur d'une surface

Une **découpe de hauteur** ne troue pas un POLYGON : elle y trace une forme
(fermée) ou un trait (ouvert) qui délimite des **faces**, chacune avec un
**delta d'altimétrie** par rapport à la face principale — un podium (`+0.2 m`),
une fosse (`-0.2 m`). Quand le polygone a une hauteur, le delta s'applique côté
haut ou côté bas.

## Dessin

Le switch « Ne pas découper (delta de hauteur) » du panneau de dessin
(`SectionHeightCutDrawingOptions`, état `mapEditor.heightCutOnCommit`) change
le résultat de deux commandes existantes :

| Commande | Sans le switch | Avec le switch |
|---|---|---|
| « Ouverture » (O) | trou dans `annotation.cuts` | forme fermée dans `annotation.heightCuts`, avec son delta et son côté |
| « Couper une surface » (F) | une annotation par pièce | trait ouvert dans `annotation.heightCuts` (`closeLine: false`) |

Commits : `useHandleCommitDrawing` (branche CUT) et
`addHeightCutLineService` (appelé par `useHandleSurfaceCutCommit`).

## Modèle de données

```js
annotation.heightCuts = [
  // forme fermée : porte le delta de la face qu'elle entoure
  { id, points: [{ pointId, type? }], delta: 0.2, side: "TOP" | "BOTTOM" },
  // trait ouvert
  { id, points: [{ pointId }], closeLine: false },
];
// delta d'une face délimitée par des traits ouverts : une graine (UN point)
annotation.heightCutFaces = [{ id, points: [{ pointId }], delta, side }];
```

- Références de points au format des lignes (`{ pointId, type }`, comme
  `guideLines` / `layoutLines`) : coordonnées normalisées dans `db.points`.
  La graine est stockée comme une ligne d'un point pour que tous les services
  qui déplacent / dupliquent / collent des points la transportent.
- **Les traits sont la source de vérité** (éditables : sommets, suppression).
  **Les faces ne sont pas stockées** : `computeHeightFaces` les recalcule à la
  résolution (`useAnnotationsV2`) à partir du contour, des trous et des traits,
  et les expose en anneaux fermés prêts à l'emploi :

```js
annotation.heightFaces = [
  { key, points, holes, delta, side, heightCutId, faceEntryId, labelPoint, area },
]; // pixels
```

- Delta d'une face : l'entrée `heightCutFaces` dont la graine est dedans, sinon
  la forme fermée la plus intérieure qui la contient, sinon 0.
- Un trait qui s'arrête dans la surface est prolongé jusqu'au bord ; une forme
  fermée qui déborde est intersectée avec le polygone.

## Affichage 2D

`NodeHeightCutsStatic` (enfant de `NodePolylineStatic`) :

- calque `INK` : voile sombre (delta > 0) ou clair (delta < 0), lignes entre
  faces — **pointillées quand la marche est côté bas** —, texte du delta à
  taille fixe par rapport à la zone d'impression (`getCotePageScale`, 14 pt) ;
- calque `HIT` (annotation sélectionnée) : une zone cliquable par face
  (`{id}::HEIGHT_FACE::{key}`) et par trait ouvert (`{id}::HEIGHT_CUT::{traceId}`).

Les faces sont recalculées dans le composant pour que les aperçus de
déplacement montrent la géométrie en cours de glissement.

## Édition

`ToolbarEditHeightCut` (ligne de `ToolbarEditAnnotation`) :

- ouverture sélectionnée (`CUT`) : switch « Découper » activé — le désactiver
  transforme le trou en face (`toggleCutHeightCutService`) ;
- face sélectionnée (`HEIGHT_FACE`) : delta, Haut / Bas (si le polygone a une
  hauteur), switch « Découper » pour l'intérieur d'une forme fermée
  (`updateHeightFaceService`) ;
- trait sélectionné (`HEIGHT_CUT`) : suppression.

Touche Suppr : `removeHeightFacePartService`.

## 3D et quantités

`triangulateHeightFaces` (appelé par `triangulateAnnotationGeometry`, donc
partagé entre le maillage 3D et `getAnnotationQties`) :

- nappe (sans hauteur) : `z = offset + delta` ;
- prisme : dessus à `hauteur + delta` (côté haut) ou dessous à `delta` (côté
  bas) ;
- contremarches verticales le long des arêtes entre deux faces de niveaux
  différents ; le prisme reste un solide fermé.

Quantités : `surface` (en plan) inchangée ; `surfaceDeveloped` = dessus
(+ dessous + faces latérales pour un prisme) **+ contremarches**.

## Limites (V1)

- POLYGON plats uniquement : avec une pente, des courbes de niveau, une coque
  ou un escalier, les deltas sont ignorés en 3D et dans les quantités.
- Pas sur les annotations `isMesh3d` ni les DISC. Un polygone portant des
  découpes de hauteur n'est pas convertible en maillage.
- « Couper une surface » (vraie coupe) laisse les découpes de hauteur sur la
  pièce principale.
- Une surface tournée (`rotation`) refuse le trait ouvert.

## Tests

```bash
node --test src/Features/heightCuts/utils/*.test.mjs
```
