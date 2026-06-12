---
name: krto-init
description: Initialize a Bimboxa "Krto" project zip (Scope export format) from one or several PDF construction plans. Use when the user attaches PDF blueprints and asks to "initialiser un Krto", "préparer un projet", "créer un scope" from plans, or any variant. The skill rasterizes PDFs to baseMap PNGs, auto-crops the plan zone (excluding cartouche/cross-sections), auto-tunes DPI to keep each image between 1-5 MB, asks the user about the business domain (e.g. "étanchéité toiture terrasse"), synthesizes a set of annotationTemplates ad-hoc, optionally seeds common reference points between plans via an interactive HTML validation UI, and produces a `.zip` matching the format consumed by the app's "Charger un Krto" button.
---

# krto-init

Generates a Bimboxa **Krto** (Scope project-data export) from PDF construction plans. The output zip is loaded via the existing **« Charger un Krto »** button in the PWA — no app changes required.

## When to use

Trigger when the user:
- attaches one or several PDFs and asks to "initialiser un Krto", "créer un projet", "préparer un scope"
- mentions a business domain like "étanchéité toiture terrasse", "cuvelage", "reprise voile contre terre", "désamiantage"
- says "voici les plans, prépare-moi un repérage"

Do NOT use when the user just wants to convert a PDF to an image (no Krto needed) or asks generic PDF questions.

## What you produce

A `.zip` saved on the user's Desktop with the structure:

```
<project>_<scope>.zip
├── project_data.json     # Dexie export (formatName: "dexie", formatVersion: 1)
└── images/
    ├── image_<baseMapId>.png      # raw PNG binary
    ├── version_<vId>_<bmId>.png   # baseMap version binary
    └── logo_<listingId>.png       # optional listing logo
```

**Critical invariant**: image binaries live ONLY in `images/`. The JSON's `files` table contains metadata only (no `fileArrayBuffer`). The app re-injects ArrayBuffers at import time.

## Workflow

> **Bash discipline — read this once and stick to it.** The project's `settings.json` pre-authorizes a fixed set of Bash patterns. To benefit from that and avoid permission prompts at every step:
>
> - **One command per Bash call.** No `&&`, no `||`, no `;`.
> - **No shell variables.** Inline literal absolute paths (`/tmp/krto-init/...`, `.claude/skills/krto-init/...`). Don't use `$WORKDIR`, `$PY`, `$(cat ...)`, etc. — the permission classifier can't statically analyze them and will prompt.
> - **No globs.** Pass `--pdfs-dir <absolute-dir>` to `pdf_to_basemaps.py`, never `--pdfs <dir>/*.pdf`.
> - **Fixed workdir**: always `/tmp/krto-init` (it's whitelisted in `additionalDirectories`). Wipe it at the very start so reruns don't mix with stale state.

Execute these steps in order. Each Python script lives in `.claude/skills/krto-init/scripts/`.

### User-facing interaction map

| Type | What | When |
|---|---|---|
| **PROMPT 1** (`AskUserQuestion`) | Project name + Krto name + blueprint scale | Step 3 |
| **HTML 1** (`zone_picker.html`) | Pick & name baseMap zones on every PDF page | Step 5 |
| **PROMPT 2** (`AskUserQuestion`) | Business domain text + "Positionner les fonds de plan dans l'espace ?" Oui/Non | Step 6 |
| **HTML 2** (`candidates.html`) | Validate common reference points across baseMaps | Step 9 — only if Oui in PROMPT 2 |

Everything else (templates synthesis, rasterization, zip build) happens **silently** — no further user input required.

### 1. Reset & prepare the fixed workdir

Run these as four **separate** Bash calls — each is a single command that matches a permission rule:

```bash
rm -rf /tmp/krto-init
```
```bash
mkdir -p /tmp/krto-init/pdfs
```
```bash
mkdir -p /tmp/krto-init/basemaps
```
```bash
mkdir -p /tmp/krto-init/previews
```

Then copy each attached PDF — one Bash call per file, literal source path:

```bash
cp /Users/FVA/Desktop/<pdf-name>.pdf /tmp/krto-init/pdfs/
```

If the user did not attach PDFs, ask them to attach the files. Do not proceed without PDFs.

### 2. Install dependencies (local venv)

Two separate Bash calls. Both are idempotent.

```bash
python3 -m venv .claude/skills/krto-init/.venv
```
```bash
.claude/skills/krto-init/.venv/bin/pip install --quiet -r .claude/skills/krto-init/requirements.txt
```

### 3. PROMPT 1 — Name + scale (single `AskUserQuestion`)

Ask in one call:
- **Project name** (default: derived from the first PDF filename, sanitized)
- **Krto/scope name** (default: same as project)
- **Blueprint scale** — 1:50 / **1:100** / 1:200 / 1:500 / other

DO NOT ask for DPI here — the skill auto-tunes it. DO NOT ask for the business domain yet — it comes after the user has picked zones.

### 4. Generate previews of every PDF page

Single Bash call, all paths literal, **use `--pdfs-dir` (not `--pdfs`)** to avoid shell globs:

```bash
.claude/skills/krto-init/.venv/bin/python .claude/skills/krto-init/scripts/pdf_to_basemaps.py --pdfs-dir /tmp/krto-init/pdfs --workdir /tmp/krto-init --phase preview
```

This writes one preview per page at ~100 DPI, plus an auto-detected bbox suggestion per page in `/tmp/krto-init/bboxes.json`.

### 5. HTML 1 — Interactive zone picker (USER selects & names baseMaps)

The user picks the zones across **all pages of all PDFs**. Each zone becomes one baseMap in the final Krto. A single PDF page may yield 0, 1, or several zones.

```bash
.claude/skills/krto-init/.venv/bin/python .claude/skills/krto-init/scripts/build_zone_picker.py --workdir /tmp/krto-init
```

```bash
open /tmp/krto-init/zone_picker.html
```

Tell the user (in French):
> Une page vient de s'ouvrir : chaque page de chaque PDF y est affichée. Pour chaque page :
> - les zones suggérées automatiquement sont déjà placées (avec un nom par défaut) — garde-les, renomme-les ou supprime-les
> - dessine de nouvelles zones en glissant la souris sur la prévisualisation
> - renomme chaque zone (ex: « Plan RDC », « Plan R+1 », « Coupe AA »)
>
> Une fois terminé, clique « Exporter validated_zones.json » et déplace le fichier téléchargé dans `/tmp/krto-init/`. Réponds OK quand c'est fait.

When they answer OK, verify `/tmp/krto-init/validated_zones.json` exists via `Read`. If missing or empty, prompt the user to retry — the next step needs it.

### 6. PROMPT 2 — Business domain + positioning option (single `AskUserQuestion`)

Ask both questions in **one** `AskUserQuestion` call:

1. **« Quels objets doit-on repérer ? (contexte métier) »** — free text.
   Example answer: *"Étanchéité toiture terrasse : membrane EPDM, relevés en partie courante, costières, évacuations d'eau pluviale, lanterneaux, joints de dilatation."*

2. **« Veux-tu positionner les fonds de plan dans l'espace ? »** — Oui / Non.
   - Yes: the skill auto-detects common reference points across baseMaps and opens an HTML page for you to validate the matches.
   - No: skip — you can calibrate manually inside the app later via the 2D calibration dialog.

After this prompt, **no further user input is required**. The skill mouline everything and outputs the zip.

### 7. Synthesize annotationTemplates ad-hoc (silent, no prompt)

Based on the domain text from prompt 2, compose 4 to 10 annotation templates and write them to `/tmp/krto-init/annotation_templates.json` (using the `Write` tool — the workdir is whitelisted). Do not ask the user to validate this list; they can edit templates later inside the app.

Each template MUST follow this shape (mirror the structure of [`src/Data/edx/annotationTemplates/CUVELAGE_GENERIQUE.js`](../../../src/Data/edx/annotationTemplates/CUVELAGE_GENERIQUE.js)):

```json
{
  "label": "Membrane EPDM",
  "labelLegend": "Membrane EPDM",
  "mappingCategories": ["OUVRAGE:MEMBRANE_EPDM"],
  "drawingShape": "POLYGON",
  "fillColor": "#4a9410",
  "fillType": "HATCHING",
  "fillOpacity": 0.8,
  "mainQtyKey": "S",
  "overrideFields": ["fillColor"],
  "defaultTool": "SURFACE_DROP"
}
```

Rules of thumb when synthesizing:
- `drawingShape`: `POLYGON` for surfaces (membranes, sols, plafonds…), `POLYLINE` for linear elements (relevés, costières, joints…), `POINT` for ponctual items (EP, lanterneaux, traversées…).
- `mainQtyKey`: `S` for surfaces (m²), `L` for linear (ml), `U` for ponctual (u).
- Pick semantically distinct `fillColor`/`strokeColor` per template (no near-duplicates).
- `mappingCategories`: use the convention `["OUVRAGE:<SHORT_CODE>"]` with an uppercase short code derived from the label.

### 8. Final rasterization (one baseMap per validated zone)

Single Bash call. Each zone in `validated_zones.json` produces one cropped PNG, auto-tuned to 1-5 MB:

```bash
.claude/skills/krto-init/.venv/bin/python .claude/skills/krto-init/scripts/pdf_to_basemaps.py --workdir /tmp/krto-init --phase final --blueprint-scale 100 --target-size-mb 3
```

Adjust `--blueprint-scale` to the value the user chose in prompt 1 (50, 100, 200, 500 — the integer after `1:`).

Writes:
- `/tmp/krto-init/basemaps/image_<id>.png` (one per zone)
- `/tmp/krto-init/basemaps/<id>.meta.json`
- `/tmp/krto-init/basemaps_index.json` (consumed by next steps)

### 9. HTML 2 — Common reference points (only if user chose "Oui" in prompt 2)

Skip this entire step if user chose **Non**, or if there is only 1 baseMap (nothing to align).

Two separate Bash calls:

```bash
.claude/skills/krto-init/.venv/bin/python .claude/skills/krto-init/scripts/detect_common_points.py --workdir /tmp/krto-init
```

```bash
open /tmp/krto-init/candidates.html
```

Tell the user: « Une page vient de s'ouvrir. Coche les paires de points correctes puis clique « Exporter ». Le fichier `validated.json` se télécharge — copie-le dans `/tmp/krto-init/`. Réponds OK quand c'est fait. »

When they answer OK, verify `/tmp/krto-init/validated.json` exists via `Read`. If missing, continue without calibration points (the step is optional).

### 10. Build the Krto zip

Single Bash call. Replace `<project-name>`, `<scope-name>`, `<domain>` with the validated values, and the output path with the user's actual home. Quote arguments that contain spaces.

```bash
.claude/skills/krto-init/.venv/bin/python .claude/skills/krto-init/scripts/build_krto_zip.py --workdir /tmp/krto-init --project-name "<project-name>" --scope-name "<scope-name>" --domain "<domain>" --out "/Users/FVA/Desktop/<project>_<scope>.zip"
```

### 11. Final response

Tell the user:
- The zip path
- How many baseMaps, listings, annotationTemplates, points were generated
- Instructions: "Ouvre l'app, clique « Charger un Krto » et sélectionne ce fichier."
- If common points were seeded: "Tu peux ensuite calibrer les baseMaps entre eux via le dialogue de calibration 2D."

## Reference: what the JSON must contain

See the working sample at `/Users/FVA/Desktop/test_1_5_1_vectorisation_murs.zip` (or `/tmp/krto_explore/project_data.json` if already extracted).

Required tables (in this order, matching the reference):

| Table | Schema | Min rows |
|---|---|---|
| `orgaData` | `key` | 0 |
| `projects` | `id,clientRef,__importTag` | 1 |
| `projectFiles` | `id` | 0 |
| `scopes` | `id,projectId` | 1 |
| `baseMaps` | `id,listingId,projectId` | N (1 per PDF page kept) |
| `baseMapViews` | `id,scopeId,baseMapId` | 0 |
| `baseMapTransforms` | `id` | 0 |
| `blueprints` | `id,projectId,scopeId,listingId` | 0 |
| `listings` | `id,key,uniqueByProject,projectId,scopeId` | 3 (baseMap-listing, annotation-listing, portfolio-listing) |
| `entities` | `id,projectId,listingId,[listingId+createdBy]` | 0 |
| `maps` | `id,projectId,listingId,[listingId+createdBy]` | 0 |
| `zonings` | `listingId` | 0 |
| `materials` | `id,projectId,listingId,[listingId+createdBy]` | 0 |
| `relsZoneEntity` | `id,projectId,listingId,zoneId,entityId` | 0 |
| `entitiesProps` | `id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId` | 0 |
| `legends` | `id,listingId` | 0 |
| `markers` | `id,mapId,listingId,targetEntityId` | 0 |
| `points` | `id,projectId,listingId,baseMapId` | 2 × #validatedPoints |
| `annotations` | `id,projectId,baseMapId,listingId,entityId,annotationTemplateId` | 2 × #validatedPoints |
| `annotationTemplates` | `id,projectId,listingId,code,label` | N (per domain) |
| `files` | `fileName,projectId,listingId,entityId` | N (1 per image) |
| `relationsEntities` | `id,listingId,sourceEntityId,targetEntityId,relationType` | 0 |
| `reports` | `id,listingId` | 0 |
| `syncFiles` | `path,scopeId` | 0 |
| `portfolioPages` | `id,listingId,scopeId,projectId` | 1 |
| `portfolioBaseMapContainers` | `id,portfolioPageId,scopeId,projectId` | N (1 per baseMap) |
| `entityModels` | `id,projectId,key` | 0 |
| `relAnnotationMappingCategory` | `id,annotationId,projectId,[nomenclatureKey+categoryKey]` | 0 |
| `baseMapVersions` | `id,baseMapId,projectId,listingId` | N (1 per baseMap) |
| `layers` | `id,baseMapId,projectId,scopeId` | N (1 per baseMap) |

`databaseName: "appDB"`, `databaseVersion: 20`.

## Invariants

- IDs: 21-char nanoid (alphabet `A-Za-z0-9_-`)
- Timestamps: ISO 8601 with `Z` suffix (e.g. `2026-05-20T07:36:22Z`)
- Point coordinates: normalized [0..1] vs `baseMap.image.imageSize` — see CLAUDE.md
- `meterByPx = (0.0254 / dpi) * blueprintScale`
- `baseMap.image.thumbnail`: data URL `data:image/webp;base64,...`, 32×32, object-fit cover, quality 80
- Empty tables MUST still appear in the `tables[]` array with `rowCount: 0` and an empty `rows: []` entry in `data[]` to match Dexie's expectation under `acceptVersionDiff: true` / `acceptMissingTables: true`

## Don't

- Don't ask the user for DPI — auto-tune it
- Don't write `fileArrayBuffer` into the JSON (binaries live in `images/`)
- Don't create `baseMapTransforms` rows
- Don't create `entities` rows (the user creates entity sheets in-app)
- Don't push the zip via `gh`, network, or any side channel — just save to Desktop and report the path
