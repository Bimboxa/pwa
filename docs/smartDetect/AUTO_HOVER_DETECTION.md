# Automatic hover detection

Copy one annotation and enable **Détection auto au survol** (`S`). Hover near
another wall and press Space to commit the proposed geometry. The former
`Ajuster` switch is folded into this option; `J` remains a compatibility alias.
Global detection (`A`) retains its existing image-template search.

## Wall reference

`detectWallHoverCandidate.js` learns from the original bitmap inside the copied
annotation, without annotation overlays. Supported geometry is a straight,
open two-point POLYLINE or STRIP, or a four-corner rectangular POLYGON without
cuts. The source needs at least five bitmap pixels of thickness and a length
of at least three times its thickness.

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
node --test src/Features/smartDetect/utils/detectWallHoverCandidate.test.mjs
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
