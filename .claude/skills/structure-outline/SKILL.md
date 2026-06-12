---
name: structure-outline
description: "Extract structural elements (concrete walls, columns) from a 2D plan image and generate the importAnnotations inline JSON. Use when the user asks to 'détourer' / outline / vectorize walls and columns from a plan image into annotations. 3-step pipeline: 1) colorize detection in red, 2) contour, 3) smooth/simplify."
allowed-tools: Read, Write, Edit, Glob, AskUserQuestion, Bash
---

# structure-outline

Turn the structural elements of a 2D plan image (concrete walls, columns) into
clean polygon annotations, exported as inline JSON for the `importAnnotations`
module (`src/Features/importAnnotations`, format documented in
`docs/annotations/IMPORT_FROM_DRAWING_PROMPT.md`).

The pipeline is image processing (OpenCV), not visual guesswork — coordinates
are pixel-accurate:

1. **Detect** (`scripts/detect.py`) — isolate structural pixels, paint them red.
2. **Contour** (`scripts/simplify.py`, step 2) — outer contours + holes.
3. **Smooth** (`scripts/simplify.py`, step 3) — Douglas-Peucker + orthogonal
   straightening; small rectangular blobs become perfect 4-point rectangles
   (columns).
4. **Export** (`scripts/build_import_json.py`) — importAnnotations JSON,
   normalized [0..1] coordinates, origin top-left.

Conversation with the user is typically in French; keep all generated files in
English except user-facing labels (Mur béton, Poteau béton).

## Step 0 — gather inputs (human in the loop)

Work autonomously on what the image tells you, but ASK the user
(AskUserQuestion) whenever plan understanding is ambiguous. Required inputs:

- **Image file path.** If the plan was pasted as a screenshot without a path,
  look for a matching recent file in `~/Desktop` and `~/Downloads`; if nothing
  matches, ask the user for the path.
- **How structure is drawn.** FIRST Read the image and inspect it. Structural
  elements are usually the thickest solid strokes, but the style varies per
  plan: thick black/grey strokes (default `--mode dark`), or a highlight color
  (e.g. red/cyan poché → `--mode color --color "#RRGGBB"`). If you cannot tell
  with confidence which graphic style marks the structure, ask the user
  (options: thick black strokes / specific color, let them name it / other).
- **Scale.** Find a written dimension on the plan (dimension line, e.g. "250"
  cm between columns, or a labeled length like "34.00m"). Measure its pixel
  extent, then `widthMeters = real_meters * imageWidth / extent_px`. Verify
  with a second dimension if available. If no dimension is legible, ask the
  user for a known length (or skip `--width-meters`; import still works
  without real scale).
- **Zones to exclude.** Spot the title block (cartouche), legends, and any
  black-framed text boxes; pass them as `--exclude x0,y0,x1,y1` (normalized)
  to detect.py. The paper frame border is trimmed automatically.

## Environment

Use the venv embedded in this skill (same pattern as krto-init):

```bash
SKILL_DIR=<this skill directory>
if [ ! -x "$SKILL_DIR/.venv/bin/python" ]; then
  python3 -m venv "$SKILL_DIR/.venv"
  "$SKILL_DIR/.venv/bin/pip" install -q opencv-python-headless numpy
fi
PY="$SKILL_DIR/.venv/bin/python"
```

Use a fresh work directory, e.g. `OUT=/tmp/structure-outline-<basename>`.

## Step 1 — detect + red overlay (MANDATORY validation checkpoint)

```bash
"$PY" "$SKILL_DIR/scripts/detect.py" "IMAGE" "$OUT" \
  [--mode dark|color] [--color "#RRGGBB"] [--gray-max 110] [--chroma-max 40] \
  [--half-thickness 5] [--min-area 600] [--exclude x0,y0,x1,y1 ...]
```

Read `$OUT/step1_overlay_preview.png` yourself, plus 2-3 zoomed crops of full
resolution areas (core/stairs, a column row, an edge) to self-check. Crops:

```bash
"$PY" -c "import cv2; im=cv2.imread('$OUT/step1_overlay_full.png'); H,W=im.shape[:2]; \
cv2.imwrite('$OUT/crop1.png', im[int(.2*H):int(.5*H), int(.2*W):int(.5*W)])"
```

Then SHOW the preview to the user and ask for validation (AskUserQuestion):
detection correct / elements missing / false positives. Iterate until the user
validates — this is the one checkpoint that must not be skipped, everything
downstream depends on it. Tuning guide:

| Symptom | Fix |
|---|---|
| thin walls missed | lower `--half-thickness` (e.g. 3.5) |
| parking lines / hatching detected | raise `--half-thickness` |
| grey walls missed | raise `--gray-max` (e.g. 140) |
| colored elements leak in | lower `--chroma-max` |
| small columns missed | lower `--min-area` |
| text fragments kept | raise `--min-area` |
| cartouche/legend detected | add `--exclude` rects |
| structure drawn in a color | `--mode color --color "#..."` |

## Steps 2+3 — contour + smooth

```bash
"$PY" "$SKILL_DIR/scripts/simplify.py" "IMAGE" "$OUT" \
  [--epsilon 2.5] [--ortho-tol 4] [--column-max-area 9000]
```

Read `$OUT/step3_simplified_preview.png`; check vertices hug the walls,
columns are clean rectangles, total points reasonable (typically < 400).
Larger `--epsilon` = fewer points; `--column-max-area` separates columns from
small wall chunks.

## Step 4 — export JSON

```bash
"$PY" "$SKILL_DIR/scripts/build_import_json.py" "$OUT" --width-meters <m> \
  -o "<image dir>/<image basename>-structure-import.json"
```

Deliver to the user:
- the JSON inline in the chat (it is formatted one annotation per line), plus
  the saved file path;
- copies of the step 1 and step 3 full overlays next to the image so they can
  double-check;
- caveats, explicitly:
  - **holes (`t*` / tpl_evidement)**: a closed wall ring (e.g. around a
    terre-plein) produces an interior contour; tell the user to subtract it
    from the parent wall polygon with the annotation subtraction feature, or
    delete it;
  - **doubtful components**: list detected blobs that may not be structural
    (isolated small masses far from the building, manhole/regard symbols) so
    the user can delete them after import;
  - curves are exported as dense vertex chains, not S-C-S arcs.

## Permissions

`allowed-tools` above pre-approves Read/Write/Bash/AskUserQuestion while this
skill runs, so the pipeline executes without permission prompts. The project
`.claude/settings.json` also allowlists this skill's venv binaries. Validation
requests to the user are limited to the explicit checkpoints (step 0 inputs +
step 1 overlay) — never ask permission-style questions for the rest.
