# annotationTransform — « Déplacer » / « Tourner » une annotation à partir d'un point

Outils de la section « Outils de dessin » (popper et panneau Dessin) :

| Outil    | Touche | 2D (plan)                          | 3D (éditeur 3D du module Dessin)    |
| -------- | ------ | ---------------------------------- | ----------------------------------- |
| Déplacer | `M`    | mode de dessin `MOVE_ANNOTATION`   | `threedEditor.moveAnnotationMode`   |
| Tourner  | `R`    | mode de dessin `ROTATE_ANNOTATION` | `threedEditor.rotateAnnotationMode` |
| Extruder | `E`    | —                                  | `threedEditor.extrudeMode`          |

Le geste est le même en 2D et en 3D :

- **Déplacer** : clic sur un point d'une annotation (elle suit la souris), clic
  sur la destination.
  `Maj` verrouille le déplacement sur un axe passant par le point cliqué,
  l'aimantation est alors ignorée : en 2D l'axe horizontal ou vertical de
  l'image (le point cliqué reste une cible d'alignement du réticule), en 3D
  l'axe utilisateur X / Y / Z du gizmo le plus proche du curseur
  (`computeAxisLockSnap`, ligne et longueur dans la couleur de l'axe ; un
  verrou Z change l'altitude, persistée en `offsetZ`).
  **Saisie clavier** `<distance>[*<copies>]` pendant le déplacement :
  - des chiffres (`1.3`) **contraignent la distance** à 1,30 m dans la
    direction courante (souris ou axe `Maj`), la souris ne donne plus que la
    direction ;
  - `*` puis des chiffres (`*3`) = **copie multiple** : l'originale reste en
    place, N copies le long du vecteur point saisi → point cliqué, la copie i
    à `i ×` le vecteur (le clic pose la 1re copie) ; `1.3*3` = 3 copies au pas
    de 1,30 m. Refusée sur un axe de révolution.
    `⌫` efface un caractère. Le badge qui suit la souris affiche la distance
    (en gras si tapée) et le `×N` ; la carte « Distance / Copie multiple » du
    helper affiche le buffer.
- **Tourner** : 1/3 clic sur le centre de rotation (un point de l'annotation),
  2/3 clic sur un point qui fixe l'axe de référence, 3/3 rotation à la souris
  (`Maj` : pas de 15° en 2D) ou angle tapé au clavier, clic ou `Entrée` pour
  valider.
  **Saisie clavier** `<angle>[*<copies>]` en 3/3 : des chiffres (`45`, `-30`,
  `12.5`) **verrouillent l'angle** ; `*` puis des chiffres (`*3`) = **copie
  multiple** : l'originale reste en place, la copie i est tournée de `i ×`
  l'angle courant autour du pivot (le clic / `Entrée` pose la 1re copie) ;
  `45*3` = 3 copies à 45°, 90° et 135°. L'angle se tape avant le `*` (ou via
  le champ Angle du helper, qui conserve la queue `*N`). Le libellé d'angle
  affiche le `×N` (en gras si l'angle est tapé) ; la carte « Copie
  multiple » du helper affiche le compteur.
- `Échap` annule dans l'ordre : l'angle / les copies tapés, la saisie en
  cours, puis l'outil.
- L'outil reste armé après une validation.

Ce dossier porte la version **2D** et l'aide partagée ; la version 3D reste dans
`threedAnnotationMove/` (et `threedExtrude/`).

## Règles communes 2D / 3D

Réutilisées depuis `threedAnnotationMove/utils/` :

- **Types acceptés** (`annotationTransformTypes.js`) : tracés à points —
  POLYLINE, POLYGON, STRIP, LINEAR_LAYOUT. Les autres types sont refusés avec
  un message.
- **Axe de révolution** : « Déplacer » l'accepte, seul (jamais avec la
  sélection), saisi par son centre ou une extrémité de son contour (bouts du
  diamètre, ou bouts du secteur en révolution partielle). Seul son centre sur
  le plan est écrit (`revolutionAxes/services/moveRevolutionAxisCenterService`) ;
  les fonds de plan verticaux liés sont re-posés. « Tourner » le refuse.
- **Annotations emportées** (`getCarriedAnnotationIdsFromSelection.js`) : si
  l'annotation saisie fait partie de la sélection, toute la sélection suit ;
  sinon elle devient la seule sélectionnée et la seule emportée.
- **En 2D, la sélection prime** : si des annotations sont sélectionnées quand
  on clique le point, c'est la sélection qui est emportée — le point cliqué
  n'est que le point de référence, même s'il appartient aussi à une autre
  annotation.
- **Droits** : `canEditAnnotation` sur chaque annotation emportée (créateur,
  liste liée en lecture seule, scope requis).

## Aide (DrawingHelper)

L'aide s'affiche dans le helper de dessin (popper flottant ou panneau Dessin
ancré), titré du nom de l'outil (`selectTransformToolTitle`).

- `SectionTransformToolHelper` : présentation partagée (consigne, champ
  numérique optionnel, raccourcis).
- `SectionTransformToolHelper2d` : conteneur 2D, lit le store de session.
- `threedDrawing/components/SectionThreedToolHelperContent` : conteneur 3D,
  lit `threedEditor` (Extruder, Déplacer, Tourner).
- En 3D, le helper s'ouvre sur `selectActiveThreedTool` (pas de
  `enabledDrawingMode`) ; les lignes d'outils sont des `RowThreedTool`
  (`TOOL_ITEMS.threedTool`).

## Version 2D — câblage

Même schéma qu'un groupe d'outils classique (cf. `surfaceCut/README.md`) :

1. `mapEditor/constants/toolItems.js` : lignes « Déplacer » / « Tourner ».
2. `mapEditor/constants/drawingTools.jsx` : `DRAWING_TOOLS` +
   `DRAWING_TOOLS_BY_TYPE`.
3. `MainMapEditorV3` : `useToolGroupHotkey("m" | "r", …, { plainOnly: true })`
   (`Maj+M` reste l'édition rapide des points) et `useAnnotationTransformTool`.
4. `InteractionLayer` : le clic (`handleWorldClick` **et**
   `handleMarkerMouseDown`, le marqueur de snap capte le clic) et le mouvement
   de souris appellent le hook. Aimantation (`annotationsForSnap`) : toutes les
   annotations, sauf celles emportées dès qu'elles suivent la souris
   (destination d'un déplacement, rotation 3/3). Le clic ne s'aimante que si
   la souris est dans la zone de déclenchement (point, ou alignement sur un
   point distant) ; sinon la pose est libre. Pendant ces phases le rendu
   d'origine des annotations emportées est masqué (`hiddenAnnotationIds`).
5. `TransformToolPreviewLayer` : aperçu (annotations emportées à leur pose
   courante + guides), monté dans `InteractionLayer` ; `TransformToolBadge` :
   le badge de valeur (distance / angle, `×N`, cadenas si tapé — le même
   `DrawingLengthBadge` que les tracés), monté dans l'overlay HTML.

### État de session

`services/transformSessionStore.js` : store module simple lu via
`useSyncExternalStore` (pas de slice Redux). Un mouvement de souris ne
re-rend que l'aperçu et l'aide. Positions en pixels du fond de plan.

### Clavier

`useAnnotationTransformTool` écoute `keydown` en phase capture, avant
`InteractionLayer` : sinon les chiffres tapés partiraient dans le buffer de
longueur de segment et `Échap` quitterait l'outil d'un coup.

### Angles

L'espace pixel a l'axe y vers le bas : un angle pixel positif tourne dans le
sens horaire à l'écran. L'angle affiché / tapé est positif dans le sens
anti-horaire (même convention qu'en 3D) — voir `utils/rotateAngle.js`.

### Écriture

`services/commitAnnotationsTransform2d.js`, jumeau pixel de
`commitAnnotationsTransformFrom3d` :

1. `getTransformPointUpdates` : nouvelles positions de tous les points
   (rotation = `applyWrapperTransformToPoints` avec une bbox de taille nulle
   centrée sur le pivot).
2. `commitWrapperTransform` : écrit dans `db.points` (normalisé), duplique les
   points partagés avec une annotation non emportée, emporte les `isMesh3d` et
   les parties peintes ; `clearRotation` pour une rotation.
3. `reflowOpeningsForHost` : les ouvertures collées suivent leur mur.
4. Le tout dans un `withUndoGroup` : un seul `Ctrl+Z`.

Ne jamais écrire de `x/y` directement dans `annotation.points`
(cf. `docs/annotations/POINTS_STORAGE.md`).

### Copie multiple

- Buffer `<valeur>[*<copies>]` : `utils/copyBuffer.js` (`appendToMoveBuffer`
  / `appendToRotateBuffer` — même grammaire, le `-` initial en plus pour
  l'angle —, `parseMoveLength`, `parseTypedAngleDeg`, `parseCopyCount`,
  `withCopyCountPart`, `scaleDeltaToLength`, `formatMoveBadge`,
  `formatRotateBadge`, `MAX_COPIES`).
  - Déplacer 2D : `transformSessionStore.copyBuffer` + `rawCursor` /
    `meterByPx` (`constrainMoveCursor` rescale le vecteur ancre → curseur à
    la distance tapée ; phase `"MOVE_COPY"` → les originales restent visibles
    et aimantables). 3D : `threedEditor.moveAnnotationMode.copyBuffer`,
    miroir `grab.copyBuffer` ; `computeMoveDeltaLocal({lengthM})` ; un
    changement de buffer rejoue le dernier pointeur de l'overlay
    (`replayMoveOverlay`).
  - Tourner 2D : le buffer d'angle `transformSessionStore.angleBuffer` porte
    toute la grammaire (`parseAngleBufferToPixelDeg` n'en lit que l'angle) ;
    phase `"ROTATE_COPY"` (3/3 avec copies) → originales visibles et
    aimantables, comme `MOVE_COPY`. 3D :
    `threedEditor.rotateAnnotationMode.angleBuffer`, miroir
    `grab.angleBuffer` ; `services/setRotateAngleBufferService` (clavier et
    champ du helper) reconstruit les fantômes et repose aussitôt.
- Écriture : `services/createTransformedAnnotationCopiesService.js`, partagé
  2D / 3D, `transform = { kind: "MOVE", deltaPx, deltaZ? }` ou
  `{ kind: "ROTATE", pivotPx, angleDeg }` (angle pixel, horaire positif).
  Chaque copie part de la **ligne stockée** de sa source (jamais de l'objet
  hydraté), sur laquelle on greffe la géométrie : points résolus transformés
  (`applyDeltaPosToAnnotation`, `partType "ROTATE"` + bbox nulle sur le
  pivot pour une rotation) puis re-frappés en nouveaux `db.points`
  (`duplicateAnnotationPoints` avec une `idMap` partagée par copie : un
  sommet commun à deux murs emportés reste commun à leurs copies). Suivent
  aussi le `mesh3d` / `mesh3dSource` (même affine pixel —
  `utils/pixelRotationAffine.js` pour une rotation), les rels de catégories,
  le calque actif, les libellés auto-numérotés ; en MOVE `rotationCenter`
  translaté et `offsetZ` (+ i × dz en 3D) ; en ROTATE la rotation est cuite
  dans les points et `rotation` / `rotationCenter` remis à zéro (règle
  `clearRotation`). **Non copiés** (comme « Dupliquer ») : ouvertures
  collées, parties peintes ; `meshLines` abandonnées. Un seul
  `withUndoGroup`, une seule transaction.
- Aperçu 3D : `threedAnnotationMove/services/moveCopyGhostsThreed.js` —
  un objet neuf par (copie, annotation) via `createAnnotationObject3D`
  (jamais un `clone()` du root : `Object3D.copy` sérialise `userData`, qui
  porte matériaux et callbacks), `userData = { isCopyGhost: true }` (ignoré
  par `buildIndex` et le picking), enfant du groupe du fond de plan, posé
  par `poseCopyGhosts` (i × delta) ou `poseCopyGhostsRotated` (i × phi
  autour du pivot — `applyRotateAnnotationsPose` est le point d'entrée
  unique de la pose, il bascule originaux / fantômes). Les originaux
  restent à leur pose de saisie ; après le drop les fantômes tiennent lieu
  des copies jusqu'à leur construction (`subscribeAnnotationReady`,
  fallback 2,5 s).

## Glossaire français → code

| Français              | Code                                   |
| --------------------- | -------------------------------------- |
| Déplacer              | `MOVE_ANNOTATION`, `kind: "MOVE"`      |
| Tourner               | `ROTATE_ANNOTATION`, `kind: "ROTATE"`  |
| point saisi / pivot   | `session.anchor`                       |
| axe de référence      | `session.reference`                    |
| annotations emportées | `session.carriedAnnotationIds`         |
| angle tapé            | `session.angleBuffer` (`<angle>[*N]`)  |
| copies tapées         | `*N` de `copyBuffer` / `angleBuffer`,  |
|                       | phases `"MOVE_COPY"` / `"ROTATE_COPY"` |
| aperçu                | `TransformToolPreviewLayer`            |

## Limites (V1)

- Tracés à points uniquement (pas de marqueur, label, image, rectangle,
  ouverture seule).

## Tests

```bash
node --test src/Features/annotationTransform/utils/*.test.mjs
node --test src/Features/threedAnnotationMove/utils/*.test.mjs
```
