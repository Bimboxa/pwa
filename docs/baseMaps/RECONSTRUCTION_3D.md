# Reconstruction 3D base maps

A **3D reconstruction** base map (`baseMap.isReconstruction3d`) is rebuilt by
an external AI chat from **photos** or from a **video** of the scene. It is the
3D cousin of the orthomosaic (`docs/baseMaps/ORTHOPHOTOS.md`): same Prompt IA
round trip, but the result is a **GLB model** — the base map then behaves like
a « Scène 3D » GLB base map (`docs/baseMaps/SCENE_3D_BASE_MAPS.md`): its image
is the top view of the model, the GLB is shown in the 3D editor.

On top of the model, the AI returns **one camera per image**. For a video,
the images are frames sampled at known times, so the cameras form a discrete
time series: time of the video ↔ camera in the 3D scene. A floating player
(bottom bar) plays the video and drives the camera of the 3D editor along it.

Code: `src/Features/reconstruction3d/`.

## Storage

| What | Where |
| --- | --- |
| Flag + media | `baseMaps.isReconstruction3d`, `baseMaps.reconstruction3d = {mediaType: "VIDEO" \| "PHOTOS", video: {fileName, srcFileName, fileSize, durationS, width, height} \| null, sampleIntervalS}` |
| Images | `db.reconstructionFrames` (v48): `{id, projectId, listingId, baseMapId, name ("F001"), index, timeS \| null, image, pose \| null}` |
| Image files | `db.files`, `reconstruction3d_frame_<id>_…` (`fileArrayBuffer`, base map `listingId`) |
| Video file | `db.files`, `reconstruction3d_video_<baseMapId>_…` (`fileBlob`, `fileType: "VIDEO"`, **no listing**) |
| Model | `baseMaps.scene3d` (`format: "GLB"`, `relativeToBaseMap: true`) + `db.files` `scene3d_<sceneId>.glb` |

`pose = {position: [x, y, z], forward: [x, y, z], hfovDeg?}` is expressed in
the **glTF frame of the model** (Y up, units of the GLB) — never in world
coordinates. The conversion to world reads the live scene graph of the 3D
editor (`utils/applyReconstructionCameraPose.js`), so the camera path follows
the base map when it is moved, turned or rescaled.

### What ships

Everything but the base map record and its image is **local to the device**:

- Krto zip (`createKrtoZip`): neither `reconstructionFrames` nor the image
  files; the video and the GLB have no listing and never ship.
  `clearScopeDataService` leaves the local rows alone.
- Project export zip: the rows and the image files ship; the video and the GLB
  (`fileBlob` rows) ship as metadata only.
- On a device without the video, the player shows the images one by one and
  offers « Recharger la vidéo ».

## The tool (right band, Fonds de plan module)

`PanelReconstruction3d` — contextual tool, enabled while the selected base map
is a reconstruction. Grid of the images, then 3 steps
(`SectionReconstructionSteps`):

1. **Drop a video or photos.** A video is sampled in the browser
   (`extractVideoFramesService`: a detached `<video>` seeked frame by frame,
   drawn on a canvas, JPEG ≤ 1600 px). One frame every
   `max(0.5 s, duration / 120)`. The AI never receives the video itself: too
   heavy for a chat, and the frame times would be the model's guess. A video
   the browser cannot decode (HEVC outside Chrome / Safari on macOS) is
   refused with a « convert to MP4 H.264 » message. A new video replaces the
   images (confirmation); photos are appended to photos.
2. **Download the prompt zip** (`buildReconstructionPromptZip`):
   `INSTRUCTIONS.md` (`docs/PROMPT_IA_RECONSTRUCTION_3D_INSTRUCTIONS.md`),
   `contexte.json` (`kind: "RECONSTRUCTION_3D"`, `media`, `frames[{name, file,
   width, height, timeS}]`) and `donnees/images/F001.jpg…`.
3. **Drop the zip returned by the AI** (`readReconstructionResultZip` →
   `parseReconstructionPromptOutput` → `applyReconstructionResultService`).

### Result format

```
reconstruction.json
reconstruction/modele.glb
```

```json
{
  "version": "1.0",
  "note": "…",
  "reconstruction": {
    "file": "reconstruction/modele.glb",
    "scaleIsMetric": false,
    "frames": [
      { "name": "F001", "position": [x, y, z], "forward": [x, y, z], "hfovDeg": 68 }
    ]
  }
}
```

The GLB must be uncompressed (no Draco / Meshopt / KTX2: `parseScene3dGlb`
bundles no decoder), Y up, in metres. `target` is accepted in place of
`forward`; an image left out simply has no camera.

### Applying a result

`applyReconstructionResultService`, one transaction:

- `parseScene3dGlb` → `bakeScene3dGlbImageService` (top view of the whole
  bbox) → the image of the **active version** is replaced, `refWidth` /
  `refHeight` follow;
- the GLB is saved (`saveScene3dGlbFileService`), `scene3d` is written with a
  new `sceneId` (the 3D editor re-attaches), the former GLB is deleted;
- every frame gets its `pose` — or loses it when the AI left it out (the
  cameras of a former model mean nothing in the new one).

Scale: a reconstruction from images alone has no metric scale. Unless the AI
states `scaleIsMetric: true`, `meterByPx` stays `null` (no measurement) and
the plan is displayed in the units of the GLB (`getBaseMapRenderScale`). With
`relativeToBaseMap`, calibrating the plan with the scale tool resizes the
model and its camera path.

### Vertical offset of the model

By default the lowest point of the model sits on the plane of the image
(`inner.z = −zone.zMin`). « Calage → Décalage Z du modèle »
(`SectionReconstructionModelOffset`, shown once a model is loaded) writes
`scene3d.offsetZ` (model units; typed in scene units, converted with the
`relativeToBaseMap` ratio): `attachScene3dGlbToBaseMapGroup` adds it to
`inner.z`, the group key and the repair key of
`useAutoLoadMapsInThreedEditor` carry it (re-attach). The camera path reads
`inner.matrixWorld`, so it follows. Loading a new result resets it.

## The player (bottom bar)

`SectionReconstruction3dBottomBarControls` (2D and 3D editors, once the base
map has images) toggles `reconstruction3d.showPlayer`;
`LayerReconstruction3d` (mounted in `SectionViewer`) then renders
`PopperReconstructionPlayer` in the floating panels host.

- **Video on the device**: the `<video>` with play / pause and a progress bar.
  At each animation frame the time of the video gives a camera by linear
  interpolation between the two surrounding samples
  (`getCameraPathPoseAtTime`).
- **Photos** (or video file missing): the images one by one, each with its own
  camera.

Coupling (`useReconstructionCameraCoupling`, 3D editor only, off in walk
mode): **one way**, the player drives the camera through
`ControlsManager.applyPoseInstant`. The 3D view switches to perspective and
takes the `hfovDeg` of the cameras (restored when the coupling ends). A press
or a wheel on the 3D canvas hands the camera back
(`reconstruction3d.coupled = false`); the link button of the player couples
again.

Known limit: `setLookAt` keeps the camera upright — the roll of the recorded
camera is not reproduced.
