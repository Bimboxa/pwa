"""Rasterize PDF pages to PNG baseMaps for a Krto.

Two phases:

  --phase preview
    Rasterize each page at low DPI (~100), run plan-zone bbox detection, and write:
      previews/<stem>_p<n>_preview.png             (raw preview)
      previews/<stem>_p<n>_preview_with_bbox.png   (preview + red overlay)
    Write a manifest:
      bboxes.json    (per-page: src_pdf, page, bbox_norm | null, ambiguous, reason)

  --phase final
    Read bboxes.json. For each page, dichotomically search a DPI in [72, 600] so the
    cropped PNG weighs target_size_mb (default 3) +/- (1..5 MB range). Generate:
      basemaps/<baseMapId>.png                 (final image)
      basemaps/<baseMapId>.meta.json
        {baseMapId, name, srcPdf, page, srcFileName, imageSize:{width,height},
         meterByPx, dpi, thumbnailDataUrl, bboxNormApplied}

Usage:
  python pdf_to_basemaps.py --pdfs a.pdf b.pdf --workdir /tmp/krto --phase preview
  python pdf_to_basemaps.py --pdfs a.pdf b.pdf --workdir /tmp/krto --phase final \
      --blueprint-scale 100 --target-size-mb 3
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import secrets
import string
import sys
from pathlib import Path

import cv2
import fitz  # PyMuPDF
import numpy as np
from PIL import Image

from detect_plan_bbox import detect_plan_bbox, draw_bbox_overlay

PREVIEW_DPI = 100
MIN_DPI = 72
MAX_DPI = 2000
SIZE_MIN_MB = 1.0
SIZE_MAX_MB = 5.0


def nanoid(size: int = 21) -> str:
    alphabet = string.ascii_letters + string.digits + "_-"
    return "".join(secrets.choice(alphabet) for _ in range(size))


def sanitize_name(s: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", s, flags=re.UNICODE)
    return s.strip("_")[:80] or "file"


def render_page_to_array(page: fitz.Page, dpi: float, clip_norm=None) -> np.ndarray:
    """Render a PyMuPDF page at given DPI, optionally clipped to a normalized bbox.

    Returns a BGR uint8 numpy array.
    """
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    clip = None
    if clip_norm is not None:
        rect = page.rect
        x0, y0, x1, y1 = clip_norm
        clip = fitz.Rect(
            rect.x0 + x0 * rect.width,
            rect.y0 + y0 * rect.height,
            rect.x0 + x1 * rect.width,
            rect.y0 + y1 * rect.height,
        )
    pix = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)
    if pix.n == 4:
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 4)
        arr = cv2.cvtColor(arr, cv2.COLOR_BGRA2BGR)
    elif pix.n == 3:
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    else:
        # grayscale
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
        arr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
    return arr


def array_to_png_bytes(arr_bgr: np.ndarray, level: int = 6) -> bytes:
    rgb = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False, compress_level=level)
    return buf.getvalue()


def make_thumbnail_data_url(arr_bgr: np.ndarray, size: int = 32) -> str:
    """Mirror generateThumbnail.js: 32x32 webp, object-fit cover, quality 80."""
    rgb = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    iw, ih = img.size
    scale = max(size / iw, size / ih)
    new_w = max(1, int(iw * scale))
    new_h = max(1, int(ih * scale))
    img = img.resize((new_w, new_h), Image.LANCZOS)
    # center-crop to size x size
    left = (new_w - size) // 2
    top = (new_h - size) // 2
    img = img.crop((left, top, left + size, top + size))
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=80)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/webp;base64,{b64}"


# ---------------------------------------------------------------------------
# Phase: preview
# ---------------------------------------------------------------------------
def run_preview(pdf_paths: list[Path], workdir: Path) -> None:
    previews_dir = workdir / "previews"
    previews_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for pdf_path in pdf_paths:
        stem = sanitize_name(pdf_path.stem)
        with fitz.open(pdf_path) as doc:
            for page_idx, page in enumerate(doc):
                arr = render_page_to_array(page, PREVIEW_DPI)
                preview_name = f"{stem}_p{page_idx + 1}_preview.png"
                cv2.imwrite(str(previews_dir / preview_name), arr)

                bbox_result = detect_plan_bbox(arr)
                label = f"score_ok" if not bbox_result.ambiguous else f"AMBIG({bbox_result.reason})"
                overlay = draw_bbox_overlay(arr, bbox_result.bbox_norm, label)
                overlay_name = f"{stem}_p{page_idx + 1}_preview_with_bbox.png"
                cv2.imwrite(str(previews_dir / overlay_name), overlay)

                manifest.append({
                    "srcPdf": str(pdf_path),
                    "pdfStem": stem,
                    "page": page_idx + 1,
                    "previewPath": str(previews_dir / preview_name),
                    "previewWithBboxPath": str(previews_dir / overlay_name),
                    "bboxNorm": list(bbox_result.bbox_norm) if bbox_result.bbox_norm else None,
                    "ambiguous": bbox_result.ambiguous,
                    "reason": bbox_result.reason,
                    "candidatesCount": bbox_result.candidates_count,
                    "pdfPageSize": {"width": page.rect.width, "height": page.rect.height},
                })

    with (workdir / "bboxes.json").open("w") as f:
        json.dump(manifest, f, indent=2)
    print(f"[preview] wrote {len(manifest)} pages -> {workdir / 'bboxes.json'}")


# ---------------------------------------------------------------------------
# Phase: final
# ---------------------------------------------------------------------------
def find_dpi_for_target_size(
    page: fitz.Page,
    clip_norm,
    target_mb: float,
    min_mb: float = SIZE_MIN_MB,
    max_mb: float = SIZE_MAX_MB,
) -> tuple[int, bytes, np.ndarray]:
    """Dichotomic DPI search to land inside [min_mb, max_mb], target ~= target_mb."""
    lo, hi = MIN_DPI, MAX_DPI
    best = None  # (dpi, png_bytes, arr)
    target_bytes = target_mb * 1024 * 1024
    min_bytes = min_mb * 1024 * 1024
    max_bytes = max_mb * 1024 * 1024

    for _ in range(12):
        dpi = (lo + hi) // 2
        arr = render_page_to_array(page, dpi, clip_norm=clip_norm)
        png = array_to_png_bytes(arr)
        size = len(png)
        # remember the best candidate that is inside [min_mb, max_mb], closest to target
        if min_bytes <= size <= max_bytes:
            if best is None or abs(size - target_bytes) < abs(len(best[1]) - target_bytes):
                best = (dpi, png, arr)
        if size < target_bytes:
            lo = dpi + 1
        else:
            hi = dpi - 1
        if lo > hi:
            break

    if best is not None:
        return best

    # No DPI landed inside [1MB, 5MB]; fall back to whichever closest at boundaries.
    candidates = []
    for dpi in (lo, hi, MIN_DPI, MAX_DPI):
        dpi = max(MIN_DPI, min(MAX_DPI, dpi))
        arr = render_page_to_array(page, dpi, clip_norm=clip_norm)
        png = array_to_png_bytes(arr)
        candidates.append((abs(len(png) - target_bytes), dpi, png, arr))
    candidates.sort(key=lambda c: (c[0], c[1]))
    _, dpi, png, arr = candidates[0]
    return dpi, png, arr


def run_final(pdf_paths: list[Path], workdir: Path, blueprint_scale: float, target_mb: float) -> None:
    """One baseMap is produced per zone in validated_zones.json.

    Falls back to bboxes.json (one baseMap per page) if no validated zones are provided,
    keeping backward compatibility with the auto-detect-only flow.
    """
    basemaps_dir = workdir / "basemaps"
    basemaps_dir.mkdir(parents=True, exist_ok=True)

    zones_file = workdir / "validated_zones.json"
    bboxes_file = workdir / "bboxes.json"

    if zones_file.exists():
        zones = json.loads(zones_file.read_text())
        source = "validated_zones.json"
    elif bboxes_file.exists():
        # Backward-compat: one zone per page using the auto-detected bbox.
        manifest = json.loads(bboxes_file.read_text())
        zones = [
            {
                "srcPdf": e["srcPdf"],
                "page": e["page"],
                "name": f"{e['pdfStem']}_p{e['page']}",
                "bboxNorm": e.get("bboxNorm"),
            }
            for e in manifest
        ]
        source = "bboxes.json (fallback)"
    else:
        raise SystemExit(
            f"Neither validated_zones.json nor bboxes.json found in {workdir}. "
            f"Run --phase preview first, then export zones via zone_picker.html."
        )
    print(f"[final] reading {len(zones)} zone(s) from {source}")

    # Open every PDF once (cache)
    docs: dict[str, fitz.Document] = {}
    try:
        for zone in zones:
            pdf_str = zone["srcPdf"]
            if pdf_str not in docs:
                docs[pdf_str] = fitz.open(pdf_str)

        out_index = []
        for zone_idx, zone in enumerate(zones):
            doc = docs[zone["srcPdf"]]
            page = doc[zone["page"] - 1]
            clip = zone.get("bboxNorm")
            clip_tuple = tuple(clip) if clip else None

            dpi, png_bytes, arr = find_dpi_for_target_size(
                page, clip_tuple, target_mb
            )

            base_id = nanoid()
            png_filename = f"image_{base_id}.png"
            (basemaps_dir / png_filename).write_bytes(png_bytes)

            h, w = arr.shape[:2]
            thumb = make_thumbnail_data_url(arr)
            zone_scale = zone.get("blueprintScale", blueprint_scale)
            meter_by_px = (0.0254 / dpi) * zone_scale

            zone_name = zone.get("name") or f"Zone {zone_idx + 1}"
            pdf_stem = Path(zone["srcPdf"]).stem
            src_file_name = f"{sanitize_name(zone_name)}.png"

            meta = {
                "baseMapId": base_id,
                "name": zone_name,
                "srcPdf": zone["srcPdf"],
                "page": zone["page"],
                "srcFileName": src_file_name,
                "fileName": png_filename,
                "imageSize": {"width": w, "height": h},
                "meterByPx": meter_by_px,
                "dpi": dpi,
                "thumbnailDataUrl": thumb,
                "bboxNormApplied": list(clip) if clip else None,
                "fileSize": len(png_bytes),
            }
            (basemaps_dir / f"{base_id}.meta.json").write_text(json.dumps(meta, indent=2))
            out_index.append(meta)
            mb = len(png_bytes) / (1024 * 1024)
            print(f"[final] {zone_name} ({pdf_stem} p{zone['page']}): dpi={dpi} size={w}x{h} bytes={len(png_bytes):,} ({mb:.2f} MB) meterByPx={meter_by_px:.6f}")

        (workdir / "basemaps_index.json").write_text(json.dumps(out_index, indent=2))
        print(f"[final] wrote {len(out_index)} basemap(s) -> {basemaps_dir}")
    finally:
        for d in docs.values():
            d.close()


# ---------------------------------------------------------------------------
def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group()
    g.add_argument("--pdfs", nargs="+", help="Input PDF files (explicit list). Required for --phase preview.")
    g.add_argument("--pdfs-dir", help="Directory containing PDFs to process. Required for --phase preview.")
    p.add_argument("--workdir", required=True, help="Working directory")
    p.add_argument("--phase", choices=["preview", "final"], required=True)
    p.add_argument("--blueprint-scale", type=float, default=100.0,
                   help="e.g. 100 for 1:100. Used in --phase final.")
    p.add_argument("--target-size-mb", type=float, default=3.0)
    args = p.parse_args(argv)

    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    if args.phase == "preview":
        if not args.pdfs and not args.pdfs_dir:
            raise SystemExit("--phase preview requires --pdfs or --pdfs-dir")
        if args.pdfs:
            pdf_paths = [Path(p) for p in args.pdfs]
        else:
            pdf_dir = Path(args.pdfs_dir)
            if not pdf_dir.is_dir():
                raise SystemExit(f"--pdfs-dir not a directory: {pdf_dir}")
            pdf_paths = sorted(pdf_dir.glob("*.pdf")) + sorted(pdf_dir.glob("*.PDF"))
            if not pdf_paths:
                raise SystemExit(f"No PDFs found in {pdf_dir}")
        for pp in pdf_paths:
            if not pp.exists():
                raise SystemExit(f"PDF not found: {pp}")
        run_preview(pdf_paths, workdir)
    else:
        run_final([], workdir, args.blueprint_scale, args.target_size_mb)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
