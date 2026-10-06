# isolateSegment — « Isoler un segment » (2D) / « Isoler une face » (3D)

Commande du panneau « Outils de dessin » du module Dessin, touche **S** dans
les deux éditeurs. Un clic sur un segment d'une polyligne / bande (2D) ou sur
une face d'un mur / d'une bande extrudés (3D) découpe l'annotation d'origine
**aux deux extrémités de ce segment** : le segment devient une annotation à
part entière, le reste devient un ou deux morceaux.

| Éditeur | Ligne / touche           | Armement                                               | Clic                                                                |
| ------- | ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| 2D      | « Isoler un segment », S | mode de dessin `ISOLATE_SEGMENT` (groupe d'outils)     | un segment (`data-part-id` `…::SEG::i`, survol vert, comme Retirer) |
| 3D      | « Isoler une face », S   | `threedEditor.isolateFaceMode` (S arme **et** désarme) | une face : côté, dessus ou about d'un mur / d'une bande             |

L'outil reste armé après un clic ; `Échap` le quitte. Le segment isolé est
sélectionné après l'écriture.

## Règles

- **Morceaux** (polyligne ouverte, segment `k`) : `before = [0..k]`,
  `isolated = [k..k+1]`, `after = [k+1..n-1]`. Un morceau de moins de 2 points
  n'existe pas (segment d'extrémité → 2 morceaux ; polyligne à 2 points →
  refus « déjà isolé »). Les morceaux **partagent** les sommets de coupe
  (mêmes `db.points`, aucun point créé).
- **Polyligne fermée** : le segment et le reste, tous deux ouverts
  (`closeLine: false`), partageant les 2 sommets.
- **Arc S-C-S** (point `type: "circle"`) : le segment cliqué est étendu à
  l'arc entier, on ne coupe jamais sur un point de contrôle.
- **Le plus long reste garde l'annotation** (id, relations objets métier /
  zones / lots, étiquette) ; longueur développée en plan sur `db.points`.
  Les autres morceaux sont créés avec les champs de l'original
  (`surfaceCut/utils/getSplitPieceProps`) et numérotés par la liste.
- **Champs conservés sur le morceau d'origine seulement** : `guideLines`,
  `isoHeightLines`, `profileLines`, `innerPoints`, `meshLines`,
  `meshLinesBySegment` (re-indexé via l'id du point de départ).
- **Drapeaux de segments** (`hiddenSegmentsPointIds` et frères) :
  matérialisés en ids (champs `…Idx` hérités vidés), puis répartis : un segment
  suit le morceau qui porte son point de départ ailleurs qu'en dernière
  position (`utils/partitionSegmentFlagIds`).
- **Ouvertures collées** : chaque `relAnnotationOpenings` passe sur le morceau
  qui contient son segment d'ancrage (`hostSegmentStartPointId` →
  `hostSegmentEndPointId`, arc compris), puis `reflowOpeningsForHost` sur tous
  les morceaux. Limite : les tables de relations sont hors undo — Ctrl+Z
  restaure les annotations, pas le lien d'hébergement.
- **Refus** (toaster, sans écriture) : autre type que POLYLINE / STRIP,
  annotation maillée (`isMesh3d`), soustraction (source ou cible), scope en
  lecture seule, annotation d'un autre auteur.
- **Pinceau 3D** : `copyMeshPaintsForSplit` répartit les parties peintes.
- **Un seul Ctrl+Z** (`withUndoGroup`).

## Architecture

| Fichier                                  | Rôle                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/isolatePolylineSegment.js`        | Pur : `(points, startIndex, closeLine)` → `{ isolated, before, after, start, end }`, chaque morceau avec ses `indices` (positions brutes). Arcs étendus.                    |
| `utils/partitionSegmentFlagIds.js`       | Pur : répartition des ids de drapeaux par morceau.                                                                                                                          |
| `utils/isolatePolylineSegment.test.mjs`  | `node --test` des deux utilitaires.                                                                                                                                         |
| `services/isolateSegmentService.js`      | Écriture unique 2D / 3D : `({ annotation (ligne brute), segmentStartPointId, projectId, imageSize, meterByPx, createAnnotationFn, updateAnnotationFn })` → `{ status, … }`. |
| `utils/isolateSegmentMessages.js`        | Toasters en français.                                                                                                                                                       |
| `utils/selectIsolatedAnnotation.js`      | Sélection du segment isolé (`setSelectedNode` + `setSelectedItem`).                                                                                                         |
| `hooks/useHandleIsolateSegment.js`       | 2D : `(annotationId, segmentIndex)` → id du point de départ lu sur l'annotation **résolue** → service.                                                                      |
| `utils/locateSegmentOnAnnotation3d.js`   | 3D : point monde → repère local du fond de plan → segment le plus proche en plan (`locatePlanPointOnPolyline`) dans la largeur du mur / de la bande.                        |
| `hooks/useIsolateFacePointerHandlers.js` | 3D : survol (stipple de face), clic, Échap. Monté par `MainThreedEditor`.                                                                                                   |

Le service reçoit toujours un **id de point de départ**, jamais un index : en
2D l'index du renderer porte sur les points résolus (orphelins retirés), en 3D
les faces fusionnent les segments colinéaires et échantillonnent les arcs.

### Câblage 2D

`mapEditor/constants/toolItems.js` (ligne, S, `editor: "2D"`),
`mapEditor/constants/drawingTools.jsx` (`ISOLATE_SEGMENT`, `behavior:
"CUT_SEGMENT"`), `InteractionLayer` (`SEGMENT_SELECT_MODES`, branche de clic
copiée de `CUT_SEGMENT`, prop `onIsolateSegment`), `StaticMapContent`
(`selectMode = "SEGMENT"`), `SectionDrawingHelperContent` (bandeau),
`MainMapEditorV3` (`useToolGroupHotkey("s", "ISOLATE_SEGMENT", { plainOnly,
yieldWhen })` + hook).

**Touche S** : `InteractionLayer` inverse déjà le sens d'ouverture d'une porte
sélectionnée sur S. Le raccourci cède (`yieldWhen`) tant que la sélection est
une ouverture `DOOR`.

### Câblage 3D

`threedEditorSlice` (`isolateFaceMode`, `setIsolateFaceModeActive`,
`closeIsolateFaceMode` appelé par chaque autre mode), `toolItems.js`
(`threedTool: "ISOLATE_FACE"`), `RowThreedTool`, `useDessinToolHotkeysThreed`
(S bascule), `selectActiveThreedTool` → `"ISOLATE_FACE"`,
`TRANSFORM_TOOL_LABELS` (titre du helper), `SectionThreedToolHelperContent`
(consigne), `MainThreedEditor` (`isolateFaceActiveRef` : clic, double-clic,
survol désactivés ; montage du hook).

## Test

```bash
node --test src/Features/isolateSegment/utils/isolatePolylineSegment.test.mjs
```
