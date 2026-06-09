# Import annotations from a hand drawing — generative-AI prompt

This prompt turns a photo/scan of a **hand-drawn sketch** into the "inline JSON"
consumed by the **Import annotations** right-panel tool (`IMPORT_ANNOTATIONS`).

Usage: paste the prompt below into a multimodal model, attach the drawing, and
paste the returned JSON into the panel's text field.

The schema is intentionally aligned with the app's `annotationTemplate` /
`annotation` model:

- coordinates are **normalized to `[0..1]`** vs the source image (origin
  top-left, `x`→right, `y`→down);
- supported types v1: **POLYLINE, POLYGON, COTE**;
- curves are encoded as an **S-C-S triplet** — a control point with
  `"type":"circle"` between two normal (`"square"`) vertices, matching
  `Features/geometry/utils/arcSampling.js`;
- `image.widthMeters` (optional) lets the importer deduce the real-world scale;
  if absent, the user fills it in the panel.

---

## Prompt

> You are a CAD/technical-drawing interpreter. You are given a single image of a
> **hand-drawn sketch** (a plan or elevation). Identify the drawn geometry and
> transcribe it into a strict JSON describing annotations for a mapping app.
> **Output ONLY the JSON** — no prose, no markdown fences.
>
> **Coordinate system**: normalized to the image, origin at the **top-left**,
> `x` increases right, `y` increases down. Every coordinate is a float in
> `[0,1]` = pixel position divided by image width (`x`) or height (`y`).
>
> **Element types to detect**:
> - **POLYLINE** — open lines/segments (an edge, a cable run, an axis).
> - **POLYGON** — closed surfaces/areas (a room, a zone, a slab). Set
>   `"closeLine": true`.
> - **COTE** — dimension lines (a measurement with arrows/ticks between two
>   points). Exactly 2 points; if a numeric value or unit is written, set
>   `"unit"` (`"MM"|"CM"|"M"`) and `"showUnitLabel": true`.
> - **Curves/arcs** — when a segment is clearly curved, model it as a 3-point
>   group on the same polyline/polygon: start vertex (no `type`), a **control
>   point lying on the arc** with `"type":"circle"`, then the end vertex.
>   Straight vertices need no `type`.
>
> **Templates**: group elements that share a meaning/color/style into one
> `annotationTemplate` (give it a short `label`, the matching `type`, and style:
> `fillColor`/`fillOpacity` for polygons, `strokeColor`/`strokeWidth`/
> `strokeWidthUnit:"PX"` for lines). Each annotation references its template via
> `annotationTemplateId`.
>
> **Scale**: if a scale bar, a dimension, or a stated overall width lets you
> infer the real-world image width in meters, set `image.widthMeters`.
> Otherwise omit it.
>
> **Output schema** (exactly this shape):
> ```json
> {
>   "version": "1.0",
>   "image": { "width": 2000, "height": 1500, "widthMeters": 12.5 },
>   "annotationTemplates": [
>     {
>       "id": "tpl_surface",
>       "label": "Surface",
>       "type": "POLYGON",
>       "fillColor": "#FF6F00",
>       "fillOpacity": 0.4,
>       "strokeColor": "#E65100",
>       "strokeWidth": 2,
>       "strokeWidthUnit": "PX"
>     }
>   ],
>   "annotations": [
>     {
>       "id": "a1",
>       "type": "POLYGON",
>       "annotationTemplateId": "tpl_surface",
>       "closeLine": true,
>       "points": [
>         { "x": 0.10, "y": 0.20 },
>         { "x": 0.40, "y": 0.20, "type": "circle" },
>         { "x": 0.50, "y": 0.50 }
>       ]
>     },
>     {
>       "id": "c1",
>       "type": "COTE",
>       "annotationTemplateId": "tpl_cote",
>       "unit": "CM",
>       "decimals": 0,
>       "showUnitLabel": true,
>       "points": [ { "x": 0.1, "y": 0.9 }, { "x": 0.6, "y": 0.9 } ]
>     }
>   ]
> }
> ```
>
> Use distinct hex colors per template. Keep ids short and unique. Prefer fewer,
> cleaner polylines over many tiny segments.
