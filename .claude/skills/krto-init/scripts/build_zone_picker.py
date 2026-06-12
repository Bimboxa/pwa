"""Generate a self-contained HTML page for picking & naming baseMap zones across all PDF pages.

Inputs:
  <workdir>/previews/<stem>_p<n>_preview.png    (from pdf_to_basemaps --phase preview)
  <workdir>/bboxes.json                          (auto-detected suggestions per page)

Output:
  <workdir>/zone_picker.html

User interaction:
  - Each PDF page is rendered with its preview
  - User can drag a rectangle on the preview to create a "zone"
  - Each zone gets a default name (Plan 1, Plan 2, ...) editable inline
  - The auto-detected bbox is pre-filled as a suggested zone (the user can keep, edit, or delete it)
  - User clicks "Exporter validated_zones.json" → downloads the JSON
  - Drops the file into <workdir>/ → resumes the skill

JSON output schema:
  [
    {"srcPdf": "/.../plan1.pdf", "page": 1, "name": "Plan RDC", "bboxNorm": [x0,y0,x1,y1]},
    ...
  ]
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path


def rel_url(preview_path: Path, html_path: Path) -> str:
    """Return a URL-encoded path relative to the HTML file's directory."""
    rel = preview_path.resolve().relative_to(html_path.resolve().parent)
    # urllib.parse.quote keeps "/" untouched so the structure is preserved
    return urllib.parse.quote(str(rel))


def build_html(pages_data: list[dict], out_path: Path) -> None:
    pages_json = json.dumps(pages_data, ensure_ascii=False)
    html = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Krto — choix des zones</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; padding: 0; }
  header.toolbar { position: sticky; top: 0; background: var(--bg, #fff); border-bottom: 1px solid #ccc; padding: 12px 20px; z-index: 100; display: flex; align-items: center; gap: 16px; }
  header h1 { margin: 0; font-size: 18px; flex: 1; }
  button { font-size: 14px; padding: 8px 14px; cursor: pointer; border: 1px solid #999; background: white; border-radius: 4px; }
  button.primary { background: #1976d2; color: white; border-color: #1976d2; }
  button.danger { background: transparent; border-color: #d32f2f; color: #d32f2f; }
  main { padding: 20px; max-width: 1200px; margin: 0 auto; }
  .page-section { margin-bottom: 36px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
  .page-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .page-header h2 { margin: 0; font-size: 16px; }
  .page-header .meta { color: #666; font-size: 13px; font-family: monospace; }
  .canvas-wrap { position: relative; display: inline-block; max-width: 100%; user-select: none; cursor: crosshair; }
  .canvas-wrap img { display: block; max-width: 100%; height: auto; }
  .canvas-wrap svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .canvas-wrap svg rect { fill: rgba(25, 118, 210, 0.15); stroke: #1976d2; stroke-width: 2; pointer-events: auto; cursor: pointer; }
  .canvas-wrap svg rect.selected { stroke: #d32f2f; stroke-width: 3; fill: rgba(211, 47, 47, 0.15); }
  .canvas-wrap svg text { fill: #1976d2; font-size: 14px; font-weight: 600; pointer-events: none; }
  .canvas-wrap svg text.selected { fill: #d32f2f; }
  .zones-list { margin-top: 12px; }
  .zones-list .zone-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .zones-list input[type=text] { flex: 1; padding: 6px 8px; font-size: 14px; border: 1px solid #aaa; border-radius: 3px; }
  .hint { color: #666; font-size: 13px; font-style: italic; margin-top: 8px; }
  #status { color: #2e7d32; font-weight: 600; }
</style>
</head>
<body>
<header class="toolbar">
  <h1>Choix des zones — <span id="counter">0</span> zone(s) sélectionnée(s)</h1>
  <span id="status"></span>
  <button id="exportBtn" class="primary">Exporter validated_zones.json</button>
</header>
<main id="root"></main>

<script>
const PAGES = __PAGES_JSON__;

// State: array of {srcPdf, page, name, bboxNorm:[x0,y0,x1,y1]}
let ZONES = [];

// Hydrate ZONES from auto-suggested bboxes (1 per page, if present)
PAGES.forEach((p, idx) => {
  if (p.suggestedBboxNorm) {
    ZONES.push({
      srcPdf: p.srcPdf,
      page: p.page,
      pdfStem: p.pdfStem,
      name: `Plan ${ZONES.length + 1}`,
      bboxNorm: p.suggestedBboxNorm,
    });
  }
});

const $ = (id) => document.getElementById(id);

function zonesForPage(pageIdx) {
  const p = PAGES[pageIdx];
  return ZONES.filter(z => z.srcPdf === p.srcPdf && z.page === p.page);
}

function renderAll() {
  const root = $('root');
  root.innerHTML = '';
  PAGES.forEach((p, pageIdx) => {
    const section = document.createElement('section');
    section.className = 'page-section';
    section.dataset.pageIdx = pageIdx;

    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `<h2>${escapeHtml(p.pdfStem)} — page ${p.page}</h2>
      <span class="meta">${p.imageW}×${p.imageH} px</span>`;
    section.appendChild(header);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'canvas-wrap';
    canvasWrap.innerHTML = `
      <img src="${p.previewUrl}" data-page-idx="${pageIdx}"/>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none"></svg>
    `;
    section.appendChild(canvasWrap);

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Glisse pour dessiner une nouvelle zone. Clique sur une zone existante pour la sélectionner.';
    section.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'zones-list';
    section.appendChild(list);

    root.appendChild(section);
    attachDrawing(canvasWrap, pageIdx);
    renderZonesForPage(pageIdx);
  });
  updateCounter();
}

function renderZonesForPage(pageIdx) {
  const section = document.querySelector(`.page-section[data-page-idx="${pageIdx}"]`);
  if (!section) return;
  const svg = section.querySelector('svg');
  const list = section.querySelector('.zones-list');

  svg.innerHTML = '';
  list.innerHTML = '';

  const zones = zonesForPage(pageIdx);
  zones.forEach((z) => {
    const globalIdx = ZONES.indexOf(z);
    const [x0, y0, x1, y1] = z.bboxNorm;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x0);
    rect.setAttribute('y', y0);
    rect.setAttribute('width', x1 - x0);
    rect.setAttribute('height', y1 - y0);
    rect.dataset.globalIdx = globalIdx;
    svg.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x0 + 0.005);
    label.setAttribute('y', y0 + 0.03);
    label.setAttribute('font-size', '0.025');
    label.textContent = z.name;
    svg.appendChild(label);

    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `
      <input type="text" value="${escapeHtml(z.name)}" data-global-idx="${globalIdx}"/>
      <button class="danger" data-global-idx="${globalIdx}">Supprimer</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.globalIdx, 10);
      ZONES[idx].name = e.target.value;
      // re-render only the SVG label, not the whole list (preserves focus)
      const svgText = svg.querySelectorAll('text')[zonesForPage(pageIdx).indexOf(ZONES[idx])];
      if (svgText) svgText.textContent = e.target.value;
    });
  });
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.globalIdx, 10);
      ZONES.splice(idx, 1);
      renderAll();
    });
  });
}

function attachDrawing(canvasWrap, pageIdx) {
  const img = canvasWrap.querySelector('img');
  let startNorm = null;
  let draftRect = null;

  function getNorm(ev) {
    const r = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)),
    };
  }

  canvasWrap.addEventListener('mousedown', (ev) => {
    if (ev.target.tagName === 'rect') return; // clicked existing rect, don't start a new one
    startNorm = getNorm(ev);
    const svg = canvasWrap.querySelector('svg');
    draftRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    draftRect.setAttribute('x', startNorm.x);
    draftRect.setAttribute('y', startNorm.y);
    draftRect.setAttribute('width', 0);
    draftRect.setAttribute('height', 0);
    draftRect.setAttribute('class', 'selected');
    svg.appendChild(draftRect);
  });
  canvasWrap.addEventListener('mousemove', (ev) => {
    if (!startNorm || !draftRect) return;
    const cur = getNorm(ev);
    const x = Math.min(startNorm.x, cur.x);
    const y = Math.min(startNorm.y, cur.y);
    const w = Math.abs(cur.x - startNorm.x);
    const h = Math.abs(cur.y - startNorm.y);
    draftRect.setAttribute('x', x);
    draftRect.setAttribute('y', y);
    draftRect.setAttribute('width', w);
    draftRect.setAttribute('height', h);
  });
  function endDraw(ev) {
    if (!startNorm || !draftRect) return;
    const cur = getNorm(ev);
    const x0 = Math.min(startNorm.x, cur.x);
    const y0 = Math.min(startNorm.y, cur.y);
    const x1 = Math.max(startNorm.x, cur.x);
    const y1 = Math.max(startNorm.y, cur.y);
    startNorm = null;
    draftRect = null;
    if ((x1 - x0) < 0.02 || (y1 - y0) < 0.02) {
      renderZonesForPage(pageIdx); // discard tiny draft
      return;
    }
    const p = PAGES[pageIdx];
    const nextNum = ZONES.length + 1;
    ZONES.push({
      srcPdf: p.srcPdf,
      page: p.page,
      pdfStem: p.pdfStem,
      name: `Plan ${nextNum}`,
      bboxNorm: [x0, y0, x1, y1],
    });
    renderAll();
  }
  canvasWrap.addEventListener('mouseup', endDraw);
  canvasWrap.addEventListener('mouseleave', (ev) => {
    if (startNorm) endDraw(ev);
  });

  // Selecting an existing rect: highlight the matching list row
  canvasWrap.addEventListener('click', (ev) => {
    if (ev.target.tagName !== 'rect') return;
    const idx = ev.target.dataset.globalIdx;
    const inp = canvasWrap.parentElement.querySelector(`input[data-global-idx="${idx}"]`);
    if (inp) {
      inp.focus();
      inp.select();
    }
  });
}

function updateCounter() {
  $('counter').textContent = ZONES.length;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

$('exportBtn').addEventListener('click', () => {
  if (ZONES.length === 0) {
    alert('Aucune zone sélectionnée — dessine au moins une zone avant d\\'exporter.');
    return;
  }
  // Strip pdfStem (internal only) before export
  const payload = ZONES.map(z => ({
    srcPdf: z.srcPdf,
    page: z.page,
    name: z.name || 'Sans nom',
    bboxNorm: z.bboxNorm,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'validated_zones.json';
  a.click();
  URL.revokeObjectURL(url);
  $('status').textContent = `${ZONES.length} zone(s) exportée(s). Dépose le fichier dans /tmp/krto-init/`;
});

renderAll();
</script>
</body>
</html>
"""
    # Use a marker substitution because the PAGES JSON can contain $ chars
    out_path.write_text(html.replace("__PAGES_JSON__", pages_json), encoding="utf-8")


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--workdir", required=True)
    args = p.parse_args(argv)

    workdir = Path(args.workdir)
    bboxes_file = workdir / "bboxes.json"
    if not bboxes_file.exists():
        raise SystemExit(f"bboxes.json missing in {workdir}. Run pdf_to_basemaps --phase preview first.")

    pages_meta = json.loads(bboxes_file.read_text())
    pages_data = []
    for entry in pages_meta:
        preview_path = Path(entry["previewPath"])
        if not preview_path.exists():
            print(f"WARN: preview missing for {entry.get('pdfStem')} p{entry.get('page')}, skipping", file=sys.stderr)
            continue
        # Best-effort: read preview dimensions from the file once
        try:
            from PIL import Image
            with Image.open(preview_path) as im:
                w_img, h_img = im.size
        except Exception:
            w_img, h_img = 0, 0
        pages_data.append({
            "srcPdf": entry["srcPdf"],
            "pdfStem": entry["pdfStem"],
            "page": entry["page"],
            "previewB64": png_to_b64(preview_path),
            "imageW": w_img,
            "imageH": h_img,
            "suggestedBboxNorm": entry.get("bboxNorm"),
        })

    out_html = workdir / "zone_picker.html"
    build_html(pages_data, out_html)
    print(f"[build_zone_picker] {len(pages_data)} pages -> {out_html}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
