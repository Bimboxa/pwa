# Structural elements detection — pool level plan

Manual vector tracing of the structural elements (load-bearing walls and
columns) visible on the pool level plan extract (vestiaires / hall d'accueil
zone), highlighted in red.

## Files

- `walls.svg` — one vector per wall (`<line>` on the wall centerline,
  `stroke-width` = wall thickness), columns as `<rect>`. Coordinate space:
  `viewBox 0 0 2000 1100`, matching the source raster pixels. The SVG
  references an optional `plan.png` background layer (the original plan
  raster); if the file is absent the red vectors render alone.
- `overlay.html` — standalone viewer: pick the original plan image with the
  file input and the SVG is overlaid on top of it, with an opacity slider.
- `renderPreview.py` — renders `preview.png` from `walls.svg` with Pillow;
  composites over `plan.png` when present in this directory.
- `preview.png` — rendered output.

## Method / status

The plan raster was provided in conversation only (not as a file), so the
walls were traced visually: thick stippled (concrete) walls were classified
as structural, thin double-line partitions (cabins, lockers) were excluded.
Openings (windows, doors) were skipped only where clearly identifiable.

To get an exact, pixel-aligned result, save the original raster as
`plan.png` (2000x1100 or any same-aspect size) in this directory and run:

```sh
python3 renderPreview.py
```
