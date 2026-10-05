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
- **Tourner** : 1/3 clic sur le centre de rotation (un point de l'annotation),
  2/3 clic sur un point qui fixe l'axe de référence, 3/3 rotation à la souris
  (`Maj` : pas de 15° en 2D) ou angle tapé au clavier, clic ou `Entrée` pour
  valider.
- `Échap` annule dans l'ordre : l'angle tapé, la saisie en cours, puis l'outil.
- L'outil reste armé après une validation.

Ce dossier porte la version **2D** et l'aide partagée ; la version 3D reste dans
`threedAnnotationMove/` (et `threedExtrude/`).

## Règles communes 2D / 3D

Réutilisées depuis `threedAnnotationMove/utils/` :

- **Types acceptés** (`annotationTransformTypes.js`) : tracés à points —
  POLYLINE, POLYGON, STRIP, LINEAR_LAYOUT. Les autres types sont refusés avec
  un message.
- **Annotations emportées** (`getCarriedAnnotationIdsFromSelection.js`) : si
  l'annotation saisie fait partie de la sélection, toute la sélection suit ;
  sinon elle devient la seule sélectionnée et la seule emportée.
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
   de souris appellent le hook ; `annotationsForSnap` propose toutes les
   annotations, sauf celles emportées une fois qu'elles suivent la souris.
5. `TransformToolPreviewLayer` : aperçu (annotations emportées à leur pose
   courante + guides), monté dans `InteractionLayer`.

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

## Glossaire français → code

| Français              | Code                                  |
| --------------------- | ------------------------------------- |
| Déplacer              | `MOVE_ANNOTATION`, `kind: "MOVE"`     |
| Tourner               | `ROTATE_ANNOTATION`, `kind: "ROTATE"` |
| point saisi / pivot   | `session.anchor`                      |
| axe de référence      | `session.reference`                   |
| annotations emportées | `session.carriedAnnotationIds`        |
| angle tapé            | `session.angleBuffer`                 |
| aperçu                | `TransformToolPreviewLayer`           |

## Limites (V1)

- Tracés à points uniquement (pas de marqueur, label, image, rectangle,
  ouverture seule).
- Pendant l'aperçu, l'annotation d'origine reste affichée à sa place.

## Tests

```bash
node --test src/Features/annotationTransform/utils/annotationTransform.test.mjs
```
