"""Pairwise ORB feature matching across baseMaps + interactive HTML UI for validation.

Reads `<workdir>/basemaps_index.json` (produced by pdf_to_basemaps.py --phase final),
runs ORB + BFMatcher + Lowe ratio test on every pair of baseMaps, keeps top 10 matches
per pair, and writes a self-contained HTML page where the user ticks the correct pairs
and clicks "Exporter" to download `validated.json`.

The HTML embeds the keypoint crops as base64 PNGs so it works offline.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ORB_FEATURES = 4000
RATIO_TEST = 0.75
TOP_K_PER_PAIR = 10
CROP_SIZE = 200
MARKER_RADIUS = 6


def load_basemap(meta: dict, workdir: Path) -> tuple[np.ndarray, dict]:
    img_path = workdir / "basemaps" / meta["fileName"]
    arr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if arr is None:
        raise FileNotFoundError(img_path)
    return arr, meta


def crop_around(arr_bgr: np.ndarray, x: float, y: float, size: int = CROP_SIZE) -> np.ndarray:
    h, w = arr_bgr.shape[:2]
    half = size // 2
    cx, cy = int(x), int(y)
    x0 = max(0, cx - half)
    y0 = max(0, cy - half)
    x1 = min(w, cx + half)
    y1 = min(h, cy + half)
    crop = arr_bgr[y0:y1, x0:x1].copy()
    # Marker at the center of the crop (which is the keypoint location)
    marker_x = cx - x0
    marker_y = cy - y0
    cv2.circle(crop, (marker_x, marker_y), MARKER_RADIUS, (0, 0, 255), 2)
    cv2.drawMarker(crop, (marker_x, marker_y), (0, 0, 255), cv2.MARKER_CROSS, 18, 2)
    # Pad to size x size if crop near image edge
    ch, cw = crop.shape[:2]
    if ch != size or cw != size:
        padded = np.full((size, size, 3), 240, dtype=np.uint8)
        padded[:ch, :cw] = crop
        crop = padded
    return crop


def array_to_png_b64(arr_bgr: np.ndarray) -> str:
    rgb = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2RGB)
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def match_pair(img_a, img_b, orb):
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY)
    kp_a, des_a = orb.detectAndCompute(gray_a, None)
    kp_b, des_b = orb.detectAndCompute(gray_b, None)
    if des_a is None or des_b is None:
        return []
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    knn = matcher.knnMatch(des_a, des_b, k=2)
    good = []
    for pair in knn:
        if len(pair) < 2:
            continue
        m, n = pair
        if m.distance < RATIO_TEST * n.distance:
            good.append((m, kp_a[m.queryIdx], kp_b[m.trainIdx]))
    good.sort(key=lambda t: t[0].distance)
    return good[:TOP_K_PER_PAIR]


def build_html(pairs_data: list[dict], out_path: Path) -> None:
    rows_html = []
    for pair_idx, pair in enumerate(pairs_data):
        match_rows = []
        for mi, m in enumerate(pair["matches"]):
            match_rows.append(f"""
              <tr>
                <td><input type="checkbox" data-pair="{pair_idx}" data-match="{mi}"/></td>
                <td class="num">{mi + 1}</td>
                <td><img src="data:image/png;base64,{m['cropA']}"/></td>
                <td><img src="data:image/png;base64,{m['cropB']}"/></td>
                <td class="num">{m['distance']:.1f}</td>
              </tr>
            """)
        rows_html.append(f"""
          <section>
            <h2>{pair['nameA']} ↔ {pair['nameB']}</h2>
            <table>
              <thead><tr><th></th><th>#</th><th>{pair['nameA']}</th><th>{pair['nameB']}</th><th>dist</th></tr></thead>
              <tbody>{''.join(match_rows)}</tbody>
            </table>
          </section>
        """)

    pairs_json = json.dumps(pairs_data, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Krto — points communs candidats</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }}
h1 {{ margin-top: 0; }}
section {{ margin: 30px 0; padding: 16px; border: 1px solid #ccc; border-radius: 8px; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ padding: 6px; border-bottom: 1px solid #eee; vertical-align: middle; }}
th {{ background: #f7f7f7; text-align: left; }}
td.num {{ font-family: monospace; text-align: right; width: 60px; }}
img {{ display: block; width: 200px; height: 200px; border: 1px solid #ddd; }}
.toolbar {{ position: sticky; top: 0; background: white; padding: 12px 0; border-bottom: 1px solid #ddd; }}
button {{ font-size: 14px; padding: 8px 14px; margin-right: 8px; cursor: pointer; }}
.primary {{ background: #1976d2; color: white; border: none; border-radius: 4px; }}
</style>
</head>
<body>
<h1>Points communs candidats</h1>
<p>Coche les paires que tu juges correctes (même point réel sur les deux plans).
Le marqueur rouge indique la position du keypoint au centre du crop.</p>
<div class="toolbar">
  <button id="checkAll">Tout cocher</button>
  <button id="uncheckAll">Tout décocher</button>
  <button id="exportBtn" class="primary">Exporter validated.json</button>
  <span id="status" style="margin-left:12px;color:#666"></span>
</div>
{''.join(rows_html)}
<script>
const PAIRS = {pairs_json};
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

$('#checkAll').onclick = () => $$('input[type=checkbox]').forEach(c => c.checked = true);
$('#uncheckAll').onclick = () => $$('input[type=checkbox]').forEach(c => c.checked = false);
$('#exportBtn').onclick = () => {{
  const validated = [];
  $$('input[type=checkbox]:checked').forEach(c => {{
    const pi = parseInt(c.dataset.pair, 10);
    const mi = parseInt(c.dataset.match, 10);
    const m = PAIRS[pi].matches[mi];
    validated.push({{
      pairIdx: pi,
      baseMapIdA: PAIRS[pi].baseMapIdA,
      baseMapIdB: PAIRS[pi].baseMapIdB,
      xNormA: m.xNormA, yNormA: m.yNormA,
      xNormB: m.xNormB, yNormB: m.yNormB,
      distance: m.distance,
    }});
  }});
  const blob = new Blob([JSON.stringify(validated, null, 2)], {{type: 'application/json'}});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'validated.json';
  a.click();
  URL.revokeObjectURL(url);
  $('#status').textContent = validated.length + ' paire(s) exportée(s). Place le fichier dans le workdir.';
}};
</script>
</body>
</html>
"""
    out_path.write_text(html, encoding="utf-8")


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--workdir", required=True)
    args = p.parse_args(argv)

    workdir = Path(args.workdir)
    idx_path = workdir / "basemaps_index.json"
    if not idx_path.exists():
        raise SystemExit(f"basemaps_index.json missing in {workdir}. Run pdf_to_basemaps --phase final first.")
    basemaps = json.loads(idx_path.read_text())
    if len(basemaps) < 2:
        print("[detect_common_points] only 1 baseMap, skipping cross-matching.")
        (workdir / "candidates.html").write_text(
            "<html><body>Un seul baseMap — pas de points communs à détecter.</body></html>",
            encoding="utf-8",
        )
        return 0

    orb = cv2.ORB_create(nfeatures=ORB_FEATURES)

    # Load all basemaps once
    images = {}
    for meta in basemaps:
        arr, _ = load_basemap(meta, workdir)
        images[meta["baseMapId"]] = arr

    pairs_data = []
    for i in range(len(basemaps)):
        for j in range(i + 1, len(basemaps)):
            ma, mb = basemaps[i], basemaps[j]
            img_a, img_b = images[ma["baseMapId"]], images[mb["baseMapId"]]
            matches = match_pair(img_a, img_b, orb)
            if not matches:
                continue
            h_a, w_a = img_a.shape[:2]
            h_b, w_b = img_b.shape[:2]
            matches_payload = []
            for m, kp_a, kp_b in matches:
                xa, ya = kp_a.pt
                xb, yb = kp_b.pt
                matches_payload.append({
                    "distance": float(m.distance),
                    "cropA": array_to_png_b64(crop_around(img_a, xa, ya)),
                    "cropB": array_to_png_b64(crop_around(img_b, xb, yb)),
                    "xNormA": xa / w_a, "yNormA": ya / h_a,
                    "xNormB": xb / w_b, "yNormB": yb / h_b,
                })
            pairs_data.append({
                "baseMapIdA": ma["baseMapId"], "nameA": ma["name"],
                "baseMapIdB": mb["baseMapId"], "nameB": mb["name"],
                "matches": matches_payload,
            })
            print(f"[detect_common_points] {ma['name']} <-> {mb['name']}: {len(matches_payload)} candidates")

    out_html = workdir / "candidates.html"
    build_html(pairs_data, out_html)
    print(f"[detect_common_points] wrote {out_html}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
