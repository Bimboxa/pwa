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

Three patches under the original annotation provide a 17-bin transverse pixel
signature: each bin stores mean luminance and contrast along the wall. Median
statistics across patches reduce noise from dimensions. Four directional
contrast statistics additionally characterize texture. This covers solid black, gray and
hatched fills. Statistics compare material appearance independently of the
hatch phase and wall length. Hatch directions are measured in bitmap space:
rotating a wall does not rotate the hatch pattern printed on the plan.

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

The candidate grows in both directions until its interior no longer matches.
A short interruption by colored dimension ink is tolerated. Image boundaries,
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
conversion; STRIP orientation; and rectangular polygon output.

The regression suite also rejects diagonal/perpendicular targets unless the
copy is explicitly rotated, rejects equal-density ink in different transverse
layers, and checks stability while the cursor moves across a parallel wall.

Screenshot checks exercise the bitmap algorithm only. They do not replace an
end-to-end browser/IndexedDB validation on the user's project.
