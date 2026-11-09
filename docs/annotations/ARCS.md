# Arcs in POLYLINE / POLYGON / STRIP annotations

## Storage

An arc is **three consecutive points typed square → circle → square** (S-C-S).
`type: "circle" | "square"` lives on the point _reference_ in `annotation.points`
(not on the `db.points` row); a missing `type` means square. The circle-typed
point is a **control point lying on the arc** (not the center, not necessarily
the apex): the circle is rebuilt from the three points at read time
(`circleFromThreePoints`, `src/Features/geometry/utils/arcSampling.js`). Chains of
two or more circles are not arcs (rendered as rough Béziers); a collinear
triplet falls back to straight lines.

The arc occupies **two stored segments** (P0 → C and C → P2).

## Chord / sagitta cotes (EDIT mode)

`NodeSegmentLengthsStatic` shows no label on the two arc halves. Instead each
exact arc gets two cotes on dotted construction lines
(`getArcDimensionItems`, geometry in `arcChordSagitta.js`):

- **chord** (« corde »): P0 → P2, label on the side opposite to the arc;
- **sagitta** (« flèche »): chord midpoint → arc apex (the arc point farthest
  from the chord). `sagitta = r + d` with `d` the signed distance from the
  chord to the center (positive on the arc side, i.e. major arcs).

Both are editable:

- **Editing the chord keeps the sagitta.** The edit goes through the contour
  solver with the arc collapsed to ONE span (`computeContourLengthEdit` wraps
  `computeSegmentLengthEdit`); afterwards the control point is re-derived with
  the same sagitta and the same angular fraction along the arc
  (`relocateArcControl`). The same rule applies when a neighbouring straight
  segment's edit propagates through an arc: a rigid run translates it, an
  absorbing arc changes its chord at constant sagitta.
- **Editing the sagitta only moves the control point** (`computeArcSagittaEdit`
  → `applyArcSagittaEditService`); a value that would flatten the arc past the
  renderer's radius bound (100 000 px) is refused as `INVALID_INPUT`.
- The chord padlock locks the whole arc (both stored halves); the sagitta has
  no padlock, and control points never carry a point padlock.
