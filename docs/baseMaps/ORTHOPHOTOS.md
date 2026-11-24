# Orthophotos (orthomosaic base maps)

An **orthomosaic** base map is a regular image base map assembled from
several top-down photos, flagged `baseMap.isOrthophoto`. Each photo keeps a
row in `db.orthophotos`: its original image, its rectified image (the "unit
orthophoto"), its camera station and the placement of the rectified image on
the mosaic.

Feature folder: `src/Features/orthophotos/`.

## Storage

`baseMaps.isOrthophoto` (boolean) — switch « Orthomosaïque » of the base map
properties panel (`FieldBaseMapIsOrthophoto`), set by the Prompt IA import.
It only gates the UI: switching it off keeps the rows.

`db.orthophotos` (`"id,projectId,baseMapId,listingId"`, Dexie v46):

| Field | Content |
|---|---|
| `baseMapId` | the orthomosaic base map |
| `listingId` | the **base map's** listing |
| `name` | station name, `P01`… |
| `fractionalIndex` | order in the list |
| `station` | `{x, y}` camera station |
| `corners` | `[tl, tr, br, bl]`, the 4 corners of the rectified image |
| `orthoImage` | `{fileName, imageSize, thumbnail, fileUpdatedAt}` rectified image |
| `sourceImage` | same shape, original photo (may be null) |

- `station` and `corners` are **inline** and **normalized `[0..1]`** on the
  base map reference image (`baseMap.getImageSize()`), origin top-left. They
  are not `db.points` rows: the Krto points filter only keeps the points
  referenced by annotations.
- Image files live in `db.files` with the base map `listingId`.
- **Local to the device** — see « Saving » below.
- The table is audited, soft-deleted, ownership-exempt (anyone manages the
  orthophotos of a base map) and **not** undoable.
- Deleting the base map soft-deletes its orthophotos (`useDeleteBaseMap`).

## Saving

Of an orthomosaic, the Krto zip only ships the **resulting image** (a regular
base map version) and the `isOrthophoto` flag. The unit orthophotos — rows,
rectified images, original photos — are left out of `createKrtoZip` (table
not exported, files excluded by name) and survive a restore
(`clearScopeDataService` does not touch them). The full project export
(`createProjectExportZip`) still carries them.

They are saved apart, from « Sauvegarde des orthophotos » of the tool
(`SectionOrthophotosArchive`, `services/orthophotosArchiveServices.js`):

```
orthophotos.json              kind "ORTHOPHOTOS_ARCHIVE", base map frame,
                              per orthophoto: name, station, corners, files
unitaires/<nn>_<name>.<ext>   rectified images
sources/<nn>_<name>.<ext>     original photos — only with « Inclure les
                              photos d'origine » (off by default)
```

The section shows the size of the original photos and of the zip
(`image.fileSize`, `hooks/useOrthophotosFileSizes`). Loading an archive made
without the original photos keeps the ones the device still has.

« Charger un zip » loads such an archive into the selected orthomosaic base
map: an orthophoto of the archive replaces the one of the same name, the
others are kept. Placements are normalized, so they fit as long as the base
map image has the proportions the archive was made on (a mismatch is
reported).

## Placement: 4 corners

The rectified image is stretched onto its 4 corners
(`utils/getOrthophotoPlacement.js`):

- corners forming a parallelogram (within 0.5 base map px) → `AFFINE`: the
  original file is drawn under an SVG `matrix(...)`;
- otherwise → `PROJECTIVE`: the image is warped once on a canvas
  (`utils/bakeOrthophotoWarp.js`, homography from
  `utils/computeQuadHomography.js`).

## Display

- `LayerOrthophotos` (mounted in `SectionViewer`, over the editors area): the
  stations as a DOM layer over the displayed 2D editor
  (`LayerOrthophotoStations`, same technique as the comment pins) and the
  floating panel of the selected one (`PopperOrthophoto`: original photo,
  draggable / resizable). Shown while the bottom bar toggle
  (`SectionOrthophotosBottomBarControls`, `orthophotos.showStations`,
  per-device) is on, or while the Orthophotos tool is opened.
- `OrthophotoOverlayLayer` (rendered by `StaticMapContent` inside the base
  map group): the rectified image of the selected orthophoto, above the
  mosaic and under the annotations.
- 2D only: nothing in the 3D editor nor in the captures.

## Orthophotos tool

Right band of the Fonds de plan module, only while the selected base map is
an orthomosaic (`ORTHOPHOTOS` in `useRightPanelTools`): list, add
(`DialogAddOrthophoto`), delete, rename, replace the images, and « Recaler ».
While the tool is opened a station can be dragged on the plan. « Recaler »
shows the outline of the rectified image with its handles: centre = move,
corner = rotate + scale about the opposite corner, Alt + corner = that corner
alone (the placement becomes projective). One db write per gesture.

## Starting from photos (« Ajouter des photos »)

An orthomosaic can start empty: the « Orthophoto » card of the base map
creation section creates a white page flagged `isOrthophoto`, with no scale.
The mosaic is then built by an external AI chat, from the section « Ajouter
des photos » of the Orthophotos tool (`SectionOrthophotoAddPhotos`,
`services/orthophotoPromptServices.js`):

1. **Photos** — dropped files, folders or zips of photos become **pending**
   rows: `sourceImage` only, `orthoImage` / `station` / `corners` null
   (`isPendingOrthophoto`). They are named `P01`, `P02`… and listed « À
   assembler »; they have no station on the plan.
2. **Prompt zip** — `buildOrthophotoPromptZip`: `INSTRUCTIONS.md`
   (`docs/PROMPT_IA_ORTHOPHOTO_INSTRUCTIONS.md`), `contexte.json`
   (`kind: "ORTHOPHOTO"`, each photo with `status: "NEW" | "PLACED"` and its
   current placement), `donnees/photos/<name>.<ext>` and, when the base map
   already has a mosaic, `donnees/mosaique.<ext>`.
3. **Result zip** — `orthophoto.json` + `orthophotos/mosaique.png` +
   `orthophotos/unitaires/<name>.png`, read by `readOrthophotoResultZip`
   (`utils/parseOrthophotoPromptOutput.js`: same `orthophoto` object as the
   project Prompt IA, a photo being designated by its `name`; the originals
   never come back) and applied by `applyOrthophotoResultService`:
   - the mosaic becomes a new **active version** of the base map; the white
     page version is dropped, a former mosaic stays as an inactive (hidden)
     version; `refWidth` / `refHeight` follow the mosaic;
   - `meterByPx` comes from the result; without it, the scale of the record
     only survives an unchanged frame;
   - each returned photo gets its rectified image, station and corners; the
     others stay pending.

When the base map already has a mosaic the instructions ask the model to keep
its frame, since the annotations and the placements are normalized on it. A
changed frame is reported to the user when annotations exist.

## Prompt IA

Project / Krto flow (`projet.json`): a base map carrying `orthophoto` instead
of `source` — see « Orthomosaïque à partir de photos » in
`src/Features/promptIaProject/docs/PROMPT_IA_PROJECT_INSTRUCTIONS.md`.

```json
{ "id": "bm_toiture", "name": "Orthomosaïque", "listing": "PLAN",
  "orthophoto": { "file": "orthophotos/toiture.png", "meterByPx": 0.004,
    "photos": [ { "name": "P01", "source": "orthophotos/sources/P01.jpg",
      "ortho": "orthophotos/unitaires/P01.png", "station": {"x": 0.31, "y": 0.42},
      "corners": [ {"x":0.18,"y":0.27}, {"x":0.46,"y":0.28}, {"x":0.45,"y":0.58}, {"x":0.17,"y":0.57} ] } ] } }
```

Parsed by `parsePromptIaProjectOutput` (`parseOrthophoto`), files extracted
by `readPromptIaProjectOutputZip` (`orthophotoFilesByPath`), created by
`createOrthophotoBaseMapsFromPromptIaService`. The annotations of an
orthomosaic are always normalized on its image, whatever `coordinateSpace`.

## Not covered yet

3D display and captures, single base map share (`baseMapShare`), remap of the
stations / corners when a base map is re-framed, per-listing Prompt IA, HEIC
photos (ignored at drop: the browser cannot decode them).
