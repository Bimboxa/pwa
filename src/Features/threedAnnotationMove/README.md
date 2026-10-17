# threedAnnotationMove — « Déplacer » / « Tourner » une annotation en 3D

Version **3D** (éditeur 3D du module Dessin) des outils « Déplacer » (`M`) et
« Tourner » (`R`) de la section « Outils de dessin ». Le geste, les règles
communes (types acceptés, annotations emportées, droits), l'aide et la
**copie multiple** sont décrits dans `annotationTransform/README.md` ; ce
dossier porte le câblage 3D.

| Outil    | Mode                                | Overlay                         | Pointeur / clavier                   |
| -------- | ----------------------------------- | ------------------------------- | ------------------------------------ |
| Déplacer | `threedEditor.moveAnnotationMode`   | `MoveAnnotationOverlayThreed`   | `useMoveAnnotationPointerHandlers`   |
| Tourner  | `threedEditor.rotateAnnotationMode` | `RotateAnnotationOverlayThreed` | `useRotateAnnotationPointerHandlers` |

Les modes sont mutuellement exclusifs avec les autres outils 3D (slice
`threedEditor`) et forcés à `false` hors du module `MAP`.

## Déplacer

1. **Saisie** : clic sur un sommet d'une annotation (aimantation « annotations
   seulement », `useAnnotationsOnlyVertexSnap`). `resolveAnnotationFromSnap`
   remonte l'annotation, son fond de plan (`group`) et son type ;
   `getCarriedAnnotationIdsFromSelection` décide des annotations emportées.
   Le grab (`moveAnnotationSessionStore`) mémorise le point saisi en monde
   et en **local du fond de plan** (`startLocal`), les poses de départ des
   roots (`rootStartPoses`) et un index d'aimantation **sans** les roots
   emportés (`buildIndex({ excludeSubtrees })`).
2. **Transport** : à chaque mouvement l'overlay cherche la cible (sommet,
   arête, plan d'un fond de plan avec sa croix, sinon plan libre face
   caméra), calcule le delta local (`computeMoveDeltaLocal` — Z inclus sur
   une vraie aimantation, ignoré sur un curseur libre, longueur tapée
   appliquée) et pose les roots (`poseCarriedAnnotations`) ou les
   fantômes de copie.
   `Maj` : verrou sur l'axe utilisateur X / Y / Z du gizmo le plus proche du
   curseur (`computeAxisLockSnap`, snap `kind: "AXIS"`, ligne et badge dans
   la couleur de l'axe) ; un verrou Z change l'altitude (`offsetZ`).
3. **Drop** : `commitAnnotationsTransformFrom3d({ kind: "MOVE", deltaLocal })`
   convertit le delta local (mètres, y vers le haut) en pixels (y vers le
   bas) et écrit `db.points` via `commitWrapperTransform` ; `offsetZ` et
   `mesh3dSource.fields.offsetZ` suivent la composante verticale ; les
   ouvertures collées suivent ; `bumpSnapIndexEpoch` rafraîchit l'index.
   Un **axe de révolution** est déplacé seul par
   `commitRevolutionAxisMoveFrom3d`.

Saisie clavier `<distance>[*<copies>]` (`setMoveCopyBufferService`, partagé
par le clavier et la carte du helper) : la distance rescale le delta
(`scaleDeltaToLength`), le `*N` bascule les roots en fantômes
(`buildCopyGhosts`) ; le drop écrit les copies par
`createTransformedAnnotationCopiesService({ kind: "MOVE" })` et tient les
fantômes jusqu'à la construction des copies (`holdCopyGhostsUntilBuilt`).
Le buffer peut être tapé **avant** la saisie (slice
`moveAnnotationMode.copyBuffer`) : `grabAtSnap` le reprend et bâtit les
fantômes aussitôt.

La construction de la saisie est dans `services/buildMoveAnnotationGrab.js`
(roots, `rootStartPoses`, `startLocal`, index cible sans les roots,
instantané des annotations), partagée par le clic de saisie et la re-saisie.

**« Recommencer à chaque clic »** (`R`, slice `moveAnnotationMode.repeat`,
la commande `ROTATE_ANNOTATION` de la toolbar des commandes cède `R` tant que le mode est actif) : au drop
de copies la saisie survit (les originaux n'ont pas bougé) avec un nouveau
jeu de fantômes posé au dernier delta, l'ancien tenant lieu des copies
écrites ; l'index cible est rafraîchi quand elles sont construites
(`refreshMoveAnnotationGrabTargets`, callback de
`holdCopyGhostsUntilBuilt`). Au drop simple, les objets sont reconstruits
par le commit (roots neufs à l'identité) : la re-saisie est **différée**
(`services/rearmMoveAnnotationAfterCommit.js`, `subscribeAnnotationReady`
des ids emportés, repli 2,5 s) puis rebâtie au point de dépôt avec le buffer
conservé. **« Copier »** (`C`, la commande `FACE_CUT` de la toolbar des commandes cède
la touche) : `services/armMoveCopyThreedService.js` — `*1` sauf copies déjà
tapées, `repeat = true`.

## Tourner

Trois clics, tout en **local du fond de plan** (rotation autour de la
normale du plan, local +Z — identique pour un plan horizontal ou vertical) :

1. **Pivot** : la cascade du 1er point d'un tracé (`computeSnapTarget`,
   `computePivotSnap`) : un sommet (celui d'une annotation fait tourner cette
   annotation, règle de sélection implicite), sinon une arête, sinon un point
   du plan de fond de plan sous le curseur — ou du plan du fond de plan
   sélectionné en 2D hors de tout plan — **aligné sur les sommets existants**
   le long des axes du plan (marqueurs rouges, bras pleins dans la couleur de
   l'axe). Hors sommet d'annotation, la sélection tourne autour du point
   cliqué, dans le repère de son fond de plan.
   Le grab (`rotateAnnotationSessionStore`) mémorise `pivotLocal`, les poses
   de départ, l'index cible sans les roots emportés et un instantané des
   annotations résolues (`carriedAnnotations`, pour les fantômes).
2. **Axe de référence** : un point aimanté ou libre ; `refBearing` =
   gisement pivot → point dans le plan XY local.
3. **Rotation** : l'angle s'ouvre entre l'axe de référence et le rayon
   pivot → curseur ; `applyRotateAnnotationsPose(editor, grab, phi)` est le
   **point d'entrée unique** de la pose (overlay, clavier, champ du helper) :
   `position' = pivot + Rz(phi)·(position0 − pivot)`, `rotation.z += phi`.
   Clic ou `Entrée` : `commitAnnotationsTransformFrom3d({ kind: "ROTATE",
pivotLocal, phi })` (angle pixel = `−phi`, pivot Y inversé), la rotation
   est cuite dans les points (`clearRotation`).

Saisie clavier `<angle>[*<copies>]` en 3/3 (`setRotateAngleBufferService`,
partagé par le clavier et le champ Angle du helper) : l'angle tapé verrouille
la pose, le `*N` construit les fantômes et les tourne de `i × phi`
(`poseCopyGhostsRotated`) pendant que les originaux restent à leur pose de
départ ; le commit écrit les copies par
`createTransformedAnnotationCopiesService({ kind: "ROTATE" })`.

## Fantômes de copie (`services/moveCopyGhostsThreed.js`)

- Un objet **neuf** par (copie, annotation), construit comme les vrais
  objets (`createAnnotationObject3D`), jamais un `clone()` du root
  (`Object3D.copy` sérialise `userData`, qui porte matériaux et callbacks de
  dispose). `userData = { isCopyGhost: true }` : ignoré par le picking et
  par `buildIndex`.
- Enfant du groupe du fond de plan, posé depuis la pose de départ du root
  (`start`, `startRotZ`) : `poseCopyGhosts(grab, delta)` pour une
  translation, `poseCopyGhostsRotated(grab, phi)` pour une rotation.
- `getGrabCopyCount(grab)` lit `grab.copyBuffer` (Déplacer) ou
  `grab.angleBuffer` (Tourner).
- Après le drop, `holdCopyGhostsUntilBuilt` garde les fantômes jusqu'à ce
  que l'`AnnotationsManager` ait construit les nouvelles annotations
  (`subscribeAnnotationReady`, tableau d'ids), fallback 2,5 s, puis les
  dispose (`disposeObject`).

## Clavier

Les handlers écoutent `keydown` en **phase capture** : `⌫` doit atteindre le
buffer avant `useDeleteAnnotationOnKeyboardInThreedEditor` (qui ouvrirait la
boîte de suppression de la sélection), et les chiffres avant les raccourcis
globaux. `Échap` : buffer tapé → saisie en cours (les roots reviennent à
leur pose de départ, fantômes jetés) → sortie du mode.

## Fichiers

- `components/` : les deux overlays SVG (aimantation, guides, badge /
  libellé d'angle avec `×N`).
- `hooks/` : les deux handlers pointeur + clavier, `useAnnotationsOnlyVertexSnap`.
- `services/` : stores de session, commits 3D → 2D, fantômes,
  `setMoveCopyBufferService` / `setRotateAngleBufferService` (buffers tapés,
  clavier + carte du helper), `buildMoveAnnotationGrab`,
  `rearmMoveAnnotationAfterCommit`, `armMoveCopyThreedService`.
- `utils/` : poses (`applyMoveAnnotationsPose`, `applyRotateAnnotationsPose`),
  `computeAxisLockSnap`, `getCarriedAnnotationIdsFromSelection`,
  `resolveAnnotationFromSnap`, `annotationTransformTypes` (partagés avec la
  2D).

## Tests

```bash
node --test src/Features/threedAnnotationMove/utils/*.test.mjs
node --test src/Features/annotationTransform/utils/*.test.mjs
```
