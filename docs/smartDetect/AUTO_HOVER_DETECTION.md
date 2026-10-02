# Automatic hover detection

Copy one straight two-point POLYLINE or STRIP and press **Space** near another
wall. This works with hover detection disabled. When no candidate is already
available, Space freezes the current mouse position and searches a circle with radius **twice the copied band width**,
acquires a band of the copied width and orientation, centers it, extends a segment
draft from the cursor, then joins it to nearby existing segments. Physical widths and bitmap
scaling are respected; the radius does not depend on zoom or copied length.
No suitable band means no write and an informational message that names the reason.

Space uses its own pipeline, `detectCopiedSegmentAtCursor.js` (see
[Space pipeline](#space-pipeline-copied-segment)); junction repair
then snaps endpoints along their own axes. L/T joints use the existing repair
algorithm (14 cm gap, 1 cm overlap when calibrated). Nearly collinear segments
with equivalent thickness close small end-to-end gaps without merging records.
Uncalibrated plans use bounded pixel tolerances. Only editable neighbor endpoints
can move. Those points receive fresh normalized IDs, so other annotations sharing
the old IDs are unaffected. Creation, category copies and neighbor updates share
one transaction; changed/deleted neighbors abort it. Repeated keydown events and
concurrent commits are ignored, and newly created footprints are masked before
the live-query refresh to prevent duplicate creation.

Optional **Détection auto au survol** (`S`) still shows hover proposals. For copied
segments, Space validates an existing candidate first, including hover and global
results. It starts a fresh local search only when there is no candidate, including
an empty global result. Other shapes retain proposal validation. A pending commit
blocks both paths so a second press cannot start a competing creation. The former
`Ajuster` switch is folded into this option; `J` remains a compatibility alias.
Global detection (`A`) retains its existing image-template search.

## Space pipeline (copied segment)

`prepareCopiedSegmentCreation.js` → `detectCopiedSegmentAtCursor.js`, plain
synchronous JS on the cached `ImageData`. Geometry decides: a band is two
parallel faces at the copied spacing and orientation. The copied material only
ranks candidates and judges continuity; a wall of another fill, a wall along a
colored surface or a wall drawn as two bare lines is still created.

**Sizes are real-world lengths.** Every tolerance of the pipeline is a length
in meters (`SIZE` in `detectCopiedSegmentAtCursor.js`, `createTolerances` in
`segmentBandFaces.js`), converted with the size of one bitmap pixel
(`meterByPx × imageScale`). A plan at 6 cm per pixel and one at 5 mm per pixel
therefore behave alike. Pixel counts only bound those lengths from below, where
the raster cannot resolve or average less (one pixel for a position, twelve
rows to average a hatch). On an uncalibrated plan the copied band is assumed
20 cm thick, which gives the scale.

| Size                                            | Value                                  | Pixel floor |
| ----------------------------------------------- | -------------------------------------- | ----------- |
| width tolerance                                 | 3 cm, or 20 % of the width             | 1.5 px      |
| outline located as one face                     | 4.5 cm, at most a quarter of the width | 1 px        |
| colored line looked through                     | 3 cm                                   | 1 px        |
| face position tolerance                         | 3 cm                                   | 1 px        |
| exterior read beside a face                     | 6 cm                                   | 3 px        |
| acquisition window                              | twice the width, within 36–72 cm       | 12 px       |
| short window (stubs)                            | the width, at least 12 cm              | 6 px        |
| window locating where faces end                 | 12 cm                                  | 6 px        |
| blank run that splits a band (opening)          | 4 cm                                   | 2 px        |
| darker transverse line stepped over             | 0.3 width, within 3–18 cm              | 2 px        |
| foreign color / one-sided junction stepped over | 2 widths, within 9 cm–1.9 m            | 3 px        |
| shortest segment                                | 4.5 cm, or the width                   | 2 px        |
| final axis correction                           | 3 cm                                   | 1 px        |

A copied band needs two bitmap pixels of thickness. Under five pixels its
interior cannot describe a material: the reference pass is skipped, faces are
the only evidence, and continuity along the axis is judged on the faces.

**1. Acquisition** — three independent passes over the same neighborhood
(windows at the cursor and shifted along the axis up to the radius, a long
window and a short one for stubs). Candidates of all passes are ranked together
by lateral distance to the cursor plus a penalty in band widths:

| Pass      | Evidence                                                                                                    | Penalty                                         |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| reference | learned material and both boundaries at the exact width (`scanAxis`, see [Wall reference](#wall-reference)) | 0                                               |
| contour   | two supported faces spaced `width ± max(3 cm, 20 %)`, interior not blank                                    | 0 when the interior matches the copy, else 0.25 |
| oneFace   | one face, the other side hidden by the exclusion mask, interior close to the copy                           | 0.4                                             |
| hollow    | two faces around blank paper (wall drawn without fill, or the gap beside a wall)                            | 0.75, or 0 when the copy itself has no material |

Faces come from `segmentBandFaces.js`: pixels are resampled in an oriented,
pixel-centered grid; each transverse column gets axial statistics (mean,
deviation, kind neutral / foreign color / unknown), which removes hatch phase
and crossing dimensions. A face is a cluster of column transitions — a gray
step, a change of kind (paper → colored fill) or both sides of a thin outline,
located at the outline center. Transitions are signed (towards darker or
lighter): a step to darker closely followed by a step to lighter is an outline,
anything wider stays two faces, so a thin filled band is not mistaken for a
line. Thin colored lines are looked through. A face must be visible in at least 60 % of the axial chunks of its
window, relative to its best chunk. Masked or out-of-image pixels are unknown:
neither for nor against. A band whose interior is hidden by the mask is an
already annotated wall and is skipped; several inner faces as strong as the
bounding ones mean a grid, not a wall (one inner face is an axis: +0.5).

**2. Centering** — the axis is the midpoint of the two faces (sub-pixel
centroids), not the best material score. The copied width is kept and centered
on it. After extension, faces are measured again over the whole span and the
axis is corrected by at most two pixels.

**3. Extension** (`extendSegmentFromCursor.js`) — starts on the valid scanline
nearest to the cursor projection and walks both ways with the scanline
classifier of the hover detector (material, ink, occlusion, blank, hard stop).
Bands without usable material (hollow, foreign-colored interior) use a
face-based classifier instead. Openings still split the wall. Two corrections
make the ends plausible:

- `confirmSpan`: windows are compared outward from the seed with the
  transverse profile of the band (column statistics of its faces and interior,
  read inside the walked span next to where the band was acquired). A failing
  run or tail cuts the span at the first transverse line or blank scanline
  followed by a different profile; a scanline test alone follows any surface
  of similar gray level. Without such a line (a crossing band, a bend) the cut
  is left to face trimming. The exterior is not part of the profile: it
  changes along a wall.
- face trimming: each end is pulled back to where a face of the band is still
  visible, measured on windows of a hatch period. A stem therefore ends at the near
  face of a crossing wall (T) and at a bend, while an L corner keeps its outer
  face and reaches the outer corner.

Minimum length is `max(3 px, min(width, 0.6 × copied length))`. Over the final
span at least one face must be supported (both for hollow bands).

**4. Junction** — `joinCopiedSegment`, unchanged (skipped by « Copie exacte »,
and for the walls « Fusionner » will fuse with).

**Options** — the « Segment similaire » card of the paste helper
(`SectionPasteHelperContent.jsx`, state `mapEditor.pasteSegmentOptions`):

- **Fusionner** (`merge`). After creation, the new segment is fused with the
  walls whose end it touches, under the rule of « Joindre » + « Fusionner si
  possible » (`getMergeJunction`): same type, same annotation template, same CM
  width, ends facing each other on one line (1 cm) or meeting at an angle, band
  on the same side for strips. `computeMergesForAnnotation` finds the nearest
  such end within 14 cm + 1.5 widths of each end of the new segment;
  `mergeCreatedSegmentService` applies them one after the other through
  `applyJoinAnnotationMergesService`. The existing wall survives and absorbs
  the new segment (its points are reused); when both ends touch a wall, the
  three become one. A contact on the body of a wall (T) is not a fusion. The
  walls to fuse with are left out of the junction repair, which would
  otherwise move their end first. Needs a calibrated plan and CM widths.
- **Copie exacte** (`exactCopy`, `detectExactCopyAtCursor.js`). The copy keeps
  its length and is placed where the pixels look like those under the
  original. Its signature is two profiles read in the corridor between its two
  faces: _across_ (faces and interior, averaged over the copied length) and
  _along_ (the band, then 10 cm beyond each end, averaged over the corridor
  width and pooled twice over 12 cm to remove the hatch pitch). The exterior is
  left out: it changes from one wall to the next. Every placement within the
  radius whose two profiles stay under 0.15 of the copy is ranked by the across
  distance plus the distance of the two end zones (so that a long copy does not
  dilute a misplaced end) plus a small distance to the cursor; on a uniform
  wall the copy therefore lands at the cursor, and next to a matching end it
  snaps to it. The axis is finally centered on the faces found under the
  placement (3 cm at most). No junction repair: the length is kept. Failure is
  `NO_SIGNATURE`.

**Exclusion mask** — the Space path masks only bands already drawn (STRIP and
POLYLINE). Surface polygons along or over a wall no longer hide it. The copied
footprint is always excluded.

**Failure reasons** — `UNSUPPORTED_REFERENCE` (not a two-point segment, thinner
than two bitmap pixels, copied from another base map), `NO_BAND`, `TOO_SHORT`,
`NOT_PLAUSIBLE`. Each maps to a toast.

**Debugging a failure** — in the browser console:

```js
localStorage.debugSegmentPaste = "1";
// press Space on the failing spot, then
copy(JSON.stringify(window.__lastSegmentPasteCase));
```

The console also logs the ranked hypotheses and their outcome. The copied JSON
holds the pixels around the copy and the cursor plus every parameter;
`restoreSegmentPasteDebugCase` (`segmentPasteDebugCase.js`) rebuilds the
options of `prepareCopiedSegmentCreation` so the case replays under node.

## Wall reference

The sections below describe `detectWallHoverCandidate.js`, the hover (`S`)
detector. Space shares its learned reference, its `scanAxis` acquisition
(pass 1) and its scanline classifier.

`detectWallHoverCandidate.js` learns from the original bitmap inside the copied
annotation, without annotation overlays. Supported geometry is a straight,
open two-point POLYLINE or STRIP, or a four-corner rectangular POLYGON without
cuts. The hover source needs at least five bitmap pixels of thickness. Two-point
segments need only three bitmap pixels of length: their explicit endpoints
already define the direction, so a short sample is valid. Rectangular polygons
still require a length of at least three times their thickness.

Three patches under the original annotation describe the material in the central
60% of the wall width. The inset keeps black outlines and adjacent whitespace
out of the learned fill when the annotation is slightly misplaced. Each patch
provides mean luminance, contrast, four directional texture statistics and a
17-bin transverse interior profile. Median statistics across patches reduce
noise from dimensions. Both pixels of a directional texture measurement stay
inside the core. This covers solid black, gray and hatched fills independently
of hatch phase and wall length, while preserving differences between interior
layers. Hatch directions are measured in bitmap space: rotating a wall does not
rotate the hatch pattern printed on the plan.

Material appearance and boundary evidence are separate checks. Width comes from
the same `strokeWidth` / `strokeWidthUnit` conversion as the canonical renderer,
including CM strips. The clipboard snapshot and paste preview use this width as
well; a 20 cm strip must not silently become a 20 pixel learning region.

The reference is cached by bitmap identity, clipboard identity and image
coordinate conversion. Unsupported shapes and cross-map references use the
existing template matcher, followed by the former local adjustment when no
exact match is found. A recognized wall with insufficient reference pixels or no material match does
not fall back to an unrelated dark shape.

## Local search and geometry

The detector searches a bounded neighborhood across the source axis at one-pixel
steps, then refines the transverse placement to half-pixel precision.
The source direction (including the explicit `R` rotation and `I` mirror) is a
constraint, as is the source thickness. The search never automatically rotates
a candidate. `R` is required to search perpendicular walls.

Transverse signature similarity and continuous evidence of both wall boundaries
reject isolated lines, incompatible fills, wrong widths and broad filled
regions. Only the transverse placement and wall length are recovered from the
image. Three additional signature checks validate the recovered span.

Detection has two distinct phases. First, try a seed window at the cursor,
then neighboring windows along the same axis (up to 1.5 sample lengths away).
This lets a cursor on a dimension label or near an endpoint acquire a clean
piece of wall. Second, extend that seed independently in both directions.
Only accept a recovered span containing the cursor, with a two-pixel endpoint
allowance, so seed search cannot jump across an opening.

The copied core also establishes whether saturated color is the material: at
least half of its samples must be colored, with a consistent dominant hue.
Matching colored pixels then participate in luminance/texture measurements.
Their fraction is checked separately so a gray fill of equal brightness cannot
replace a blue column. Unrelated colors remain occlusions. A neutral reference
continues to ignore colored dimensions. Square/short references also lower the
minimum recovered candidate length, so a column is not rejected by the long-wall
aspect-ratio guard.

Colored dimension ink may interrupt up to two wall widths (capped at 128 bitmap
pixels). A thin darker drafting line may interrupt up to 0.3 wall widths
(capped at 12 pixels). The allowable scanline brightness variation depends on the learned material
contrast. An explicit near-white/no-texture check stops pale hatching at blank
openings. Neither updates the endpoint until matching material
resumes, and neither allowance applies to blank openings. Final signature
checks seek clean neighboring windows instead of rejecting a whole wall
because one confirmation window lands on a dimension label. Image boundaries,
the source footprint and annotation exclusion masks stop extension. Real
openings longer than two bitmap scanlines split the wall. Each candidate is
one straight segment; it does not turn corners or trace a complete network.

Candidates carry explicit `placedPoints` in reference pixel coordinates.
The existing Space commit hook persists those points through `db.points`
with normalized coordinates, preserving the copied annotation's style and
mapping categories. STRIP control points remain on the appropriate edge.

## Interaction safeguards

Searches are throttled to 250 ms. Request versions discard asynchronous
results after pointer movement, rotation, mode changes or validation. Detection
pauses during a Space commit and invalidates the exclusion mask afterwards.
Bitmap caches are refreshed when the source image changes.

## Validation

Run:

```sh
node --test src/Features/smartDetect/utils/*.test.mjs src/Features/annotations/utils/computeJoinAnnotationEnds.test.mjs src/Features/annotations/services/persistDetectedJunctionEdits.test.mjs
npm run build
```

The synthetic fixtures cover black, gray and hatch fills; horizontal, vertical
and oblique walls; variable length; source/mask exclusion; openings; colored
dimensions; phase changes; incompatible textures/thicknesses; physical unit
conversion; canonical CM strips without legacy width fields; STRIP orientation;
slightly misplaced references; pale hatching beside solid gray/white regions;
and rectangular polygon output.

The regression suite also rejects diagonal/perpendicular targets unless the
copy is explicitly rotated, rejects equal-density ink in different transverse
layers, and checks stability while the cursor moves across a parallel wall.

## Real-plan regression

The original `1.2 SS - hachures.pdf` was rendered at the published reference size
5952 x 3009. A 20 cm source wall at x=2494, y=736..991 (0.0151190476190476 m/px)
was used to detect the parallel walls at x=2309 and x=2838 from seven cursor
positions each, including the dimension crossing. The former detector missed
those crossings and split the right wall at y=837/846. The two-phase detector
recovers approximately y=723..1000 and y=647..990 respectively at all tested
positions, with less than one pixel of endpoint variation.

The material-core update also checks source offsets of -2, -1, 0, 1 and 2 pixels
for POLYLINE and both STRIP sides. Before this update, even a one-pixel source
offset could reject every target. These tests use the same seven positions on
each target wall and assert the complete recovered endpoints.

The PDF and its rendered images remain outside the repository. This validates
the bitmap algorithm on the actual plan, not the browser/IndexedDB commit flow.

The Space pipeline was replayed on that PDF rendered at four resolutions, with
the same reference-pixel cursor positions and the same 20 cm copy (source wall
x=2494, y=736..991):

| Rendering                          | Band    | Basin wall (12 cursors)        | x=2309 (9)         | x=2838, stem (9)        | Top wall with `R` (6)              |
| ---------------------------------- | ------- | ------------------------------ | ------------------ | ----------------------- | ---------------------------------- |
| 0.5 cm/px (crop, `imageScale` 1/3) | 39.7 px | 2092.5, 1145..1553 ×12         | 723..1000 ×9       | 2838.2, 659..990 ×9     | ..2488 ×6 (crop edge on the right) |
| 1.5 cm/px (published size)         | 13.2 px | 2092.5, 1143..1553 ×12         | 723..1000 ×9       | 2838.3, 656–658..990 ×9 | 4462..2488 ×6                      |
| 3 cm/px (`imageScale` 2)           | 6.6 px  | 2093, 1140–1144..1552 ×12      | 2310, 724..1000 ×9 | 2838, 657–658..990 ×9   | 4468..2490 ×6                      |
| 6 cm/px (`imageScale` 4)           | 3.3 px  | 2094, 1132–1136..1544–1556 ×10 | 2311, 736..992 ×6  | 2840, 660..988 ×7       | 4460..2500–2504 ×6                 |

The wall along the blue retention basin (x=2085..2100) was undetectable before:
a saturated exterior left no valid boundary sample. It now runs from the bend
of the wall (y≈1146) down to the line closing it above the grille (y=1553).
The x=2838 wall is a stem under the top wall: it ends at the near face of that
wall (y≈659) instead of crossing it (y≈647). At 6 cm per pixel the band is 3.3
pixels thick — it was rejected as too thin before — and the remaining cursors
either pick a neighboring pair of lines, also 3–4 pixels apart, or find too
short a piece. Empty areas and a perpendicular wall without `R` return
`NO_BAND` at every resolution.
« Copie exacte » was replayed on the same renderings with a 100-pixel piece
and the whole of the source wall. At 0.5, 1.5 and 3 cm per pixel the piece
lands on the axis of the basin wall centered on the cursor, and on the top wall
with `R`; the whole wall lands inside the x=2309 wall and on the x=2838 stem.
At 3 cm per pixel the x=2309 wall is missed (its outlines fall between two
pixels, which changes a six-pixel profile), and at 6 cm per pixel nearly
everything is: an exact signature needs more pixels than a similar segment.
Empty areas and a perpendicular wall without `R` return `NO_SIGNATURE`.

These checks exercise the preparation pipeline; browser keypress and commit UI
remain a manual verification step.

Short-source regressions cover POLYLINE and STRIP samples from one to 2.5 band
widths long, with hatch/gray/black fill and a mask over the copied footprint.
The candidate follows the uncovered continuation and stops at the source. On
the real PDF, 12 short samples (three locations, four length/width ratios)
recovered the complete upper continuation without overlapping the copy.

Column regressions cover square gray/blue fills crossed by drafting axes, blue
shade tolerance, canonical CM strips on either side, and rejection of different
hues or equal-luminance neutral fills. They are synthetic bitmap tests; the
user's actual column plan and browser commit flow have not been replayed.
