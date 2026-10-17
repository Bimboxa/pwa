# annotationTransform — « Déplacer » / « Tourner » une annotation à partir d'un point

Commandes de la toolbar unifiée des commandes (`Features/commandsToolbar`) :

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
    (verrouillée dès le 1er caractère tapé) et le `×N` ; la carte
    « Distance - Copies multiples » du helper affiche et édite le buffer.
- **Tourner** : 1/3 clic sur le centre de rotation (un point de l'annotation,
  ou n'importe quel point — arête, plan, point libre — si les annotations à
  tourner sont sélectionnées), 2/3 clic sur un point qui fixe l'axe de référence,
  3/3 rotation à la souris
  (`Maj` : pas de 15° en 2D) ou angle tapé au clavier, clic ou `Entrée` pour
  valider.
  **Saisie clavier** `<angle>[*<copies>]` en 3/3 : des chiffres (`45`, `-30`,
  `12.5`) **verrouillent l'angle** ; `*` puis des chiffres (`*3`) = **copie
  multiple** : l'originale reste en place, la copie i est tournée de `i ×`
  l'angle courant autour du pivot (le clic / `Entrée` pose la 1re copie) ;
  `45*3` = 3 copies à 45°, 90° et 135°. L'angle se tape avant le `*` (ou
  dans le champ Angle de la carte, qui conserve la queue `*N`). Le badge
  d'angle affiche le `×N` (verrouillé dès le 1er caractère tapé) ; la carte
  « Angle - Copies multiples » du helper affiche et édite le buffer.
- **Déplacer — « Recommencer à chaque clic »** (`R`, interrupteur de la
  carte du helper) : après le clic de destination, la saisie continue —
  avec des copies (`*N`), l'originale et son point saisi restent en main et
  chaque clic pose N copies de plus ; sans copies, l'annotation déplacée est
  re-saisie à sa destination (le clic suivant la déplace encore ; une
  distance tapée s'applique à chaque clic). L'option tombe en quittant
  l'outil. **« Copier »** (`C`, bouton de la carte) : écrit `*1` si aucune
  copie n'est tapée (la distance tapée est conservée) et coche
  « Recommencer » — armé ou en transport. Le buffer peut être tapé **avant**
  la saisie (chiffres, `*`, `⌫`) : la saisie suivante le reprend.
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
  **En 2D** (`utils/transform2dTypes.js`, `isTransformable2dType`) s'y
  ajoutent COTE et RULER (leurs sommets sont aussi des `db.points`, le
  pipeline d'écriture est le même, les offsets de cotation suivent) pour
  « Déplacer » et « Tourner », et FREE_TEXT pour « Déplacer » seulement :
  sa géométrie est inline (`targetPoint` / `labelPoint` normalisés), écrite
  par `utils/getFreeTextMoveUpdates.js` dans le même groupe d'annulation.
  Un texte se saisit par le centre de sa boîte (et sa cible s'il a un
  connecteur), aimantés pour ces outils seulement (`_snapPoints` posés dans
  `annotationsForSnap`), ou par un clic n'importe où dans la boîte
  (`handleWorldClick` : repli sur le nœud `data-annotation-type="FREE_TEXT"`
  sous le curseur ; `handleMouseDown` annule le drag legacy des groupes
  `draggable` quand l'outil est armé, et `NodeFreeTextStatic` laisse alors
  remonter le mousedown d'un texte sélectionné). La liste 3D ne change pas.
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
- `SectionTypedConstraint` : carte « Distance / Angle - Copies multiples »
  (2D et 3D) : champ valeur (unité, cadenas) et champ copies, éditables ;
  elle écrit le même buffer que le clavier (`setMoveCopyBuffer` /
  `setRotateAngleBuffer` en 2D, `setMoveCopyBufferService` /
  `setRotateAngleBufferService` en 3D).
- `SectionMoveRepeatOptions` : carte « Recommencer à chaque clic » (`R`,
  interrupteur) / « Copier » (`C`, bouton) de « Déplacer », 2D et 3D, sous
  la carte Distance ; le bouton est inerte sur un axe de révolution.
- `SectionTransformToolHelper2d` : conteneur 2D, lit le store de session.
- `threedDrawing/components/SectionThreedToolHelperContent` : conteneur 3D,
  lit `threedEditor` (Extruder, Déplacer, Tourner).
- En 3D, le helper s'ouvre sur `selectActiveThreedTool` (pas de
  `enabledDrawingMode`) ; les boutons sont les commandes `MOVE_ANNOTATION` /
  `ROTATE_ANNOTATION` de la toolbar unifiée (`Features/commandsToolbar`).

## Version 2D — câblage

Même schéma qu'un groupe d'outils classique (cf. `surfaceCut/README.md`) :

1. `commandsToolbar/commands/moveAnnotation` et `rotateAnnotation` : commandes « Déplacer » / « Tourner » (bouton + raccourci M / R, `plainOnly`).
2. `mapEditor/constants/drawingTools.jsx` : `DRAWING_TOOLS` +
   `DRAWING_TOOLS_BY_TYPE`.
3. Raccourcis M / R : métadonnées `hotkey` des deux commandes (`useCommandsHotkeys`)
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

Deux niveaux de remise à zéro : `resetTransformSession()` lâche la saisie
(annulation, fin de commit, clic nul) mais garde `repeat` ;
`resetTransformTool()` (sortie de l'outil) efface tout, buffer tapé à
l'avance et `repeat` compris. `endTransformCommit()` est le point unique de
fin d'écriture (couche d'aperçu quand les annotations reviennent, timer de
repli) : il lâche la saisie, ou — « Recommencer à chaque clic » — la garde
telle quelle (copies) ou re-saisit à la destination (`anchor = cursor`).
`copiesRefused` (axe de révolution, disque) fait ignorer la queue `*N`.

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

### Copie multiple (translation ou rotation)

Deux fonctionnalités jumelles, portées par la même saisie clavier
`<valeur>[*<copies>]`, le même service d'écriture et le même aperçu 3D.

#### Copie par translation (« Déplacer », `M`)

- Pendant le déplacement (point saisi, destination en attente), taper `*`
  puis un nombre : `*3`. L'originale **reste en place** ; le clic (ou la
  distance tapée) pose la **1re copie**, la copie i est posée à `i ×` le
  vecteur point saisi → point cliqué (modèle SketchUp « 3x », pas de mode
  « répartir »). `1.3*3` = 3 copies au pas de 1,30 m ; `Maj` + `*3` = 3
  copies le long d'un axe.
- Les copies emportent la géométrie (points, découpes, points intérieurs,
  lignes guides / de niveau / de profil), le `mesh3d` des annotations
  `isMesh3d`, `rotationCenter` translaté, `offsetZ` (+ i × dz pour un drop
  3D aimanté à une autre altitude), les catégories, le calque actif et un
  libellé auto-numéroté.
- Refusée sur un axe de révolution (toast `MULTI_COPY_UNSUPPORTED_MESSAGE`).

#### Copie par rotation (« Tourner », `R`)

- En 3/3 (pivot et axe de référence fixés), taper `*` puis un nombre : `*3`.
  L'originale **reste en place** ; le clic / `Entrée` pose la **1re copie**
  à l'angle courant (souris ou tapé), la copie i est tournée de `i ×`
  l'angle autour du pivot. `45*3` = 3 copies à 45°, 90° et 135° ; `-30*2`
  = 2 copies à −30° et −60°. L'angle se tape **avant** le `*` ; le champ
  Angle du helper n'édite que l'angle et conserve la queue `*N`.
- Les copies emportent la même géométrie que ci-dessus, tournée autour du
  pivot ; le `mesh3d` suit par la même affine pixel ; la rotation est
  **cuite dans les points** : `rotation` et `rotationCenter` sont remis à
  zéro (règle `clearRotation`), `offsetZ` inchangé.
- Pas de rotation sur un axe de révolution (déjà refusé par « Tourner »).

#### Commun aux deux

- `⌫` efface un caractère du buffer, `Échap` efface le buffer avant
  d'annuler la saisie. L'originale reste **visible et aimantable** pendant
  l'aperçu (phases `"MOVE_COPY"` / `"ROTATE_COPY"` en 2D, fantômes en 3D).
- Le badge affiche la valeur (brute et verrouillée dès le 1er caractère
  tapé) et le `×N` ; la carte « Distance / Angle - Copies multiples » du
  helper (`SectionTypedConstraint`) montre les deux champs — valeur avec
  unité et cadenas, « x » copies — chacun éditable, avec ses touches en
  regard. Les raccourcis de la section « Raccourcis clavier » ne répètent
  pas ces touches.
- **Non copiés** (comme « Dupliquer ») : ouvertures collées, parties
  peintes ; `meshLines` abandonnées. Un seul `withUndoGroup`, une seule
  transaction : un `Ctrl+Z` retire toutes les copies (un par clic en mode
  « Recommencer à chaque clic »).

#### « Recommencer à chaque clic » (`R`) et « Copier » (`C`) — Déplacer

- `repeat` : 2D `transformSessionStore.repeat`, 3D
  `threedEditor.moveAnnotationMode.repeat` ; conservé d'une saisie à
  l'autre, remis à `false` en quittant l'outil. Le badge ajoute `↻`.
- Au dépôt avec `repeat` : copies → la saisie survit (2D : `committing`
  retombe seulement ; 3D : la saisie reste, un **nouveau** jeu de fantômes
  est bâti pour les copies suivantes, l'ancien tient lieu des copies écrites,
  puis l'index cible est rafraîchi quand elles sont construites) ; sans
  copies → re-saisie à la destination (2D : `anchor = cursor` ; 3D : différée
  jusqu'à la reconstruction des objets, `rearmMoveAnnotationAfterCommit`).
- « Copier » : `withDefaultCopyCount` (`*1` sauf copies déjà tapées) +
  `repeat = true` — 2D `armMoveCopy()`, 3D `armMoveCopyThreedService`.
  Refusé (toast) sur un axe de révolution.
- Buffer tapé à l'avance (outil armé, rien de saisi) : 2D
  `setMoveCopyBuffer` accepte `kind === null`, la saisie reprend
  `state.copyBuffer` ; 3D `moveAnnotationMode.copyBuffer` reste posé sans
  saisie (`setMoveAnnotationCarriedIds` ne l'efface plus — les handlers le
  vident explicitement à la fin d'un transport sans `repeat`), la saisie le
  reprend et bâtit aussitôt les fantômes.
- Touches : en 2D, `R` / `C` n'ont pas d'autre propriétaire tant que
  `MOVE_ANNOTATION` est armé. En 3D, la commande `ROTATE_ANNOTATION` cède `R`
  et la commande `FACE_CUT` cède `C` (`hotkey.yieldWhen`) tant que
  `moveAnnotationMode.active`.

#### Mécanique

- Buffer `<valeur>[*<copies>]` : `utils/copyBuffer.js` (`appendToMoveBuffer`
  / `appendToRotateBuffer` — même grammaire, le `-` initial en plus pour
  l'angle —, `parseMoveLength`, `parseTypedAngleDeg`, `parseCopyCount`,
  `withCopyCountPart`, `scaleDeltaToLength`, `formatMoveBadge`,
  `formatRotateBadge`, `MAX_COPIES`).
  - Déplacer 2D : `transformSessionStore.copyBuffer` + `rawCursor` /
    `meterByPx` (`constrainMoveCursor` rescale le vecteur ancre → curseur à
    la distance tapée). 3D : `threedEditor.moveAnnotationMode.copyBuffer`,
    miroir `grab.copyBuffer` ; `computeMoveDeltaLocal({lengthM})` ; un
    changement de buffer rejoue le dernier pointeur de l'overlay
    (`replayMoveOverlay`).
  - Tourner 2D : le buffer d'angle `transformSessionStore.angleBuffer` porte
    toute la grammaire (`parseAngleBufferToPixelDeg` n'en lit que l'angle).
    3D : `threedEditor.rotateAnnotationMode.angleBuffer`, miroir
    `grab.angleBuffer` ; `services/setRotateAngleBufferService` (clavier et
    champ du helper) reconstruit les fantômes et repose aussitôt.
- Écriture : `services/createTransformedAnnotationCopiesService.js`, partagé
  2D / 3D, `transform = { kind: "MOVE", deltaPx, deltaZ? }` ou
  `{ kind: "ROTATE", pivotPx, angleDeg }` (angle pixel, horaire positif ; la
  3D passe `−phi` et inverse le Y du pivot comme
  `commitAnnotationsTransformFrom3d`). Chaque copie part de la **ligne
  stockée** de sa source (jamais de l'objet hydraté), sur laquelle on greffe
  la géométrie : points résolus transformés (`applyDeltaPosToAnnotation`,
  `partType "ROTATE"` + bbox nulle sur le pivot pour une rotation) puis
  re-frappés en nouveaux `db.points` (`duplicateAnnotationPoints` avec une
  `idMap` partagée par copie : un sommet commun à deux murs emportés reste
  commun à leurs copies). `mesh3d` / `mesh3dSource` suivent la même affine
  pixel (`utils/pixelRotationAffine.js` pour une rotation).
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
  fallback 2,5 s). Voir `threedAnnotationMove/README.md`.

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

- Tracés à points, cotes, règles et textes (2D) uniquement : pas de
  marqueur, label, image, rectangle, ouverture seule. Un texte ne se tourne
  pas.

## Tests

```bash
node --test src/Features/annotationTransform/utils/*.test.mjs
node --test src/Features/threedAnnotationMove/utils/*.test.mjs
```
