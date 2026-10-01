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

Three interior patches provide a median luminance, standard deviation and
four directional contrast statistics. This covers solid black, gray and
hatched fills. Statistics compare material appearance independently of the
hatch phase and wall length. Hatch directions are measured in bitmap space:
rotating a wall does not rotate the hatch pattern printed on the plan.

The reference is cached by bitmap identity, clipboard identity and image
coordinate conversion. Unsupported shapes and cross-map references use the
existing template matcher, followed by the former local adjustment when no
exact match is found. A supported wall reference with no material match does
not fall back to an unrelated dark shape.

## Local search and geometry

The detector searches a bounded neighborhood around the cursor over multiple
orientations, then refines the best orientations and transverse positions.
Appearance similarity and evidence of both wall boundaries reject isolated
lines, incompatible fills and broad filled regions. Thickness is inherited
from the reference; length and direction are recovered from the image.

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

A manual bitmap check on the supplied screenshot, using the left vertical
hatched wall as a reference, recovered the upper horizontal wall across the
blue dimension line and pink cursor marker. This is an algorithm check, not
an end-to-end browser/IndexedDB validation on the user's project.
