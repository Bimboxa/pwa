# Krnet sync in Bimboxa — plans, positions, shapes

Krnet (notes-app, mobile, `/Users/FVA/Projets/Notes/notes-app`) is a pure
Supabase backend. Bimboxa pulls one project ("dossier") into one scope
through the "Sync" right-panel tool (`src/Features/notesApp/`). The listing
configuration part is documented in [LISTING_CONFIG.md](LISTING_CONFIG.md).

## Orchestrator (`services/syncNotesAppScope.js`)

One `get_project_changes(projectId, 0)` RPC dump (`fetchNotesAppProjectDump`,
rows normalized by `utils/normalizeNotesAppRow.js`: snake→camel, JSON strings
parsed — `settings`, `fields`, `points`… — unix seconds → ms), then:

1. plans merge, once at project level (`mergeNotesAppBaseMaps`);
2. per mapped (remote list → "Ouvrages" listing) pair: business objects,
   templates (`resolveNotesAppTemplates`), positions
   (`mergeNotesAppPositions`), shapes (`mergeNotesAppShapes`), listing
   config;
3. plan ↔ location post-pass (all pairs merged);
4. ONE transaction under `withSystemWrite(withoutUndo(...))` on `scopes,
listings, businessObjects, relsBusinessObjectAnnotation, baseMaps,
baseMapVersions, annotations, annotationTemplates, points, files`.

Downloads (private bucket `project-files`, signed URLs) happen before the
transaction. Merge rule everywhere: write iff absent locally or remote
signature newer than the local `updatedAt` (`utils/isRemoteNewer.js`);
remote `deleted_at` → explicit tombstone row (never `.delete()`).

## `scope.notesApp` (single source of truth, travels in Krto)

```js
{
  projectId, projectName, linkedAt, lastSyncAt, lastSyncStatus,
  listingsMapping: [{ remoteListingId, remoteListingName,
    localListingId | null, mode: "mapped" | "ignored",
    lastSyncAt, lastSyncCounts: { entities, positions, shapes } }],
  baseMapsMapping: [{ remoteBaseMapId, remoteBaseMapName,
    localListingId | null, mode: "mapped" | "ignored", lastSyncAt }],
}
```

Absence of an entry is the default: lists → "create a linked Ouvrages
listing"; plans → the project's default BASE_MAP listing (`key ===
"mapsGeneric"`, else the first one, else created from
`appConfig.presetListingsObject.mapsGeneric`). Only explicit choices are
persisted (`utils/resolveNotesAppScopeLink.js`).

## Plans (`base_maps` → `db.baseMaps`)

UI: "Plans Krnet → fonds de plan de la mission"
(`SectionNotesAppBaseMapsMapping`, remote rows from `fetchNotesAppBaseMaps`):
one Select per plan over the project's base-map listings
(`useProjectBaseMapListings`) + "Ignorer"; "Créer une liste « Fonds de plan »"
only when the project has none. Status line: imported into <listing> / not
imported / no image / ignored, plus the resolved locations.

| case                                    | result                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| no entry                                | default listing                                            |
| `mapped` to a live listing              | that listing                                               |
| `mapped` to a deleted listing           | default listing                                            |
| `ignored`                               | skipped; a previously imported plan is left untouched;     |
|                                         | positions / shapes on it are counted `skipped`             |
| target ≠ current `listingId`            | MOVED inside the tx (`useMoveBaseMapToListing` cascade:    |
|                                         | versions, files, annotations/points tagged with the source |
|                                         | listing), even when the remote row is not newer            |
| no `image_storage_path`, never imported | skipped (`counts.skipped`, toaster "plan(s) sans image")   |

Row fields written by the sync: `idMaster` (Krnet id), `remoteSource:
"notesApp"`, `remoteUpdatedAt` (ms), `notesAppStoragePath` (skips the
re-download when unchanged), `image` / `refWidth` / `refHeight` + one
`baseMapVersions` row ("Image d'origine"), `notesAppLocationEntityIds`
(Krnet `settings.locationEntityIds`, verbatim),
`notesAppLocationBusinessObjectIds` (same ids resolved to local business
objects — post-pass, informative only for now), `meterByPx` +
`notesAppMeterByPx` from Krnet `settings.scale` (metres per px of
`scale.imageWidth`, rescaled to the local image width; written only while
the local value is the imported one so a Bimboxa calibration is never
clobbered).

The push direction ("Fonds de plan → Krnet", `pushNotesAppBaseMap`) is
unchanged: active version image + `base_maps` upsert, links a
Bimboxa-authored plan (`idMaster`) on first push.

## Positions (Krnet `MARKER` → Bimboxa `LABEL`)

Krnet: one `annotations` row per entity (`entity_id` UNIQUE locally, `x`/`y`
normalized 0..1). Bimboxa: LABEL of the businessObjects listing, inline
normalized `targetPoint` / `labelPoint` (no `db.points`), issued from the
listing's own LABEL template, rel `{ isMain: true, baseMapId }` with the
`setMainAnnotationForBusinessObjectService` invariants (Krnet wins).

## Shapes (Krnet `POLYLINE` / `POLYGON` → Bimboxa annotations + `db.points`)

Krnet: `annotations` rows with `entity_id` null, `listing_id` = list active
at draw time (may be null), `points` JSON `[{x,y}]` normalized, `close_line`,
style columns; linked to entities through `rels_entity_annotation
{annotation_id, entity_id, listing_id, is_main, base_map_id}` (N-N).

Bimboxa (`mergeNotesAppShapes`, pure core
`utils/mapNotesAppShapeToAnnotation.js`):

- a shape belongs to the pair whose remote list is its `listingId`, or (null)
  to the first pair owning one of its linked objects (`claimedShapeIds`);
- annotation `{ type, drawingShape: type, closeLine (POLYGON always true),
points: [{id}], cuts: [] (POLYGON), annotationTemplateId (the listing's
own POLYLINE / POLYGON template, created from the drawing-shape defaults
colored with the Krnet list color — POLYGON strokes render in fillColor),
label = linked object's label (main first), showLabel: true, style copied
from the template, idMaster / remoteSource / remoteUpdatedAt }`;
- `db.points` rows `{ id, x, y, baseMapId, projectId, listingId, scopeId,
forMarker: false }` — coordinates copied verbatim, FRESH ids on every
  write (old points stay as live orphans, `POINTS_STORAGE.md` rule, GC by
  `purgeDeletedAnnotationsService`); never reused by index, never deleted;
- degenerate shapes (< 2 / 3 finite points) are skipped;
- remote signature = max(annotation, rels, linked entities `updatedAt`): a
  rename of the object does not bump the Krnet annotation row;
- rels: one local rel per (annotation, object) pair, `idMaster` = Krnet rel
  id. Krnet `is_main` is honoured only when no live main rel exists for
  (object, base map) after the positions pass (a Krnet MARKER is by
  definition the position), else the rel is plain (no `isMain` /
  `baseMapId` keys). Both passes share one rels context per pair
  (`{ listingRels, relRowsById }`), written once.

## Traps

- Krnet never sets `is_main` on shapes today (`useDrawMode.js`), the rule
  above is defensive.
- SQLite ships `close_line` / `is_main` as 0/1: always coerce with
  `Boolean()`.
- `db.points` creating hook skips the scope stamp under system write: the
  sync stamps `scopeId` explicitly.
- `getAnnotationTemplateCode` keys on `fillColor`: POLYLINE templates of
  the same listing share a code — harmless (`code` is a plain index).
- `useLocateByLocation.js` (Krnet) overwrites the whole `settings` object
  when creating a plan from a location — only `locationEntityIds` survives
  there; the Bimboxa side reads both keys defensively.

Node replay of the pure core: `scripts/replay/notesAppShapesReplay.js`.
