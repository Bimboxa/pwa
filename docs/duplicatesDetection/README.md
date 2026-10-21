# Duplicates detection (`src/Features/duplicatesDetection`)

« Détection des doublons »: a commands-toolbar command (`DETECT_DUPLICATES`,
2D editor) that finds the POLYLINE / STRIP annotations **of the same template**
whose paths overlap, totally or partially, on the main base map. It completes
the exact-geometry « Doublons » card of the listing properties
(`findDuplicateAnnotations`), which stays in place.

## Flow

1. `ButtonDetectDuplicates` (toolbar) or « Relancer » (helper) calls
   `useRunDuplicatesDetection().run(annotations, { meterByPx, baseMapId })`.
2. `getDuplicateCandidates` keeps the lines / strips of the base map with a
   template (no footprints, base map annotations, mesh cells, orphans);
   `serializeAnnotationsForDetection` strips them to a structured-clone
   payload (`id, type, annotationTemplateId, layerId, closeLine, points, cuts`).
3. `duplicatesDetectionService.runDuplicatesDetection` posts
   `{ type: "DETECT", runId, annotations, options }` to
   `workers/duplicatesDetection.worker.js` (one worker per run, the previous
   one terminated) and resolves on `{ type: "RESULT", runId, result }`.
   Without workers (or `USE_WORKER = false`) the matcher runs on the main
   thread after a macrotask.
4. `findOverlappingAnnotations` (pure): rings via `buildAnnotationEdgeRings`
   (arcs expanded), groups by `annotationTemplateId|type`, bbox sweep, then
   `findSharedEdgeChains` per pair in both directions; overlap = summed chain
   length (px). Output `{ pairs, duplicates, stats }`, one `duplicates` entry
   per annotation (`overlapPx`, `ownLengthPx`, `coverage`, `isTotal`,
   `partnerIds`).
5. `duplicatesDetectionSlice` holds `status` (`idle | running | done | error`),
   `runId` (stale results are ignored), `result`, the run's `meterByPx` /
   `hasScale` (px → m formatting) and the user `toleranceCm`.

## Parameters (`constants/duplicatesDetectionConstants.js`)

- tolerance: `toleranceCm` of the slice (default 2 cm, field in the helper),
  `TOLERANCE_PX_FALLBACK` without scale, floor `MIN_THRESHOLD_PX`;
- minimum shared length: `max(2 × tolerance, MIN_OVERLAP_M | MIN_OVERLAP_PX)`;
- `TOTAL_COVERAGE`: coverage ratio above which a duplicate is « total ».

## Helper display

`status !== "idle"` swaps the Dessin surface to the duplicates helper:

- docked left panel: `PanelDrawing` → `SectionPanelDuplicatesHelper`;
- drawer mode: `PopperMapListings` helper chain → `PopperDuplicatesHelper`.

Precedence: paste > subtraction pick > armed draw / 3D tool > duplicates >
normal content (an armed draw hides the helper without clearing the result).
`SectionDuplicatesHelperContent` mounts its own `useAnnotationsV2` (main base
map, same scope as the « Doublons » card) to label the rows and select on
click (`useSelectAnnotationFromPanel`). Escape, « Quitter » and a base map
switch (`setSelectedMainBaseMapId` extraReducer) clear the run.
