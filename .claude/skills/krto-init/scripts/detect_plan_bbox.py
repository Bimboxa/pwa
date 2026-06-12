"""Detect the "plan zone" bbox in a rasterized construction blueprint.

Pipeline: grayscale -> Otsu threshold -> large morphological closing -> contours ->
score each candidate by (area * fill_ratio * (1 - edge_distance_penalty)).

Returns a normalized bbox [x0, y0, x1, y1] in [0..1] coords of the input image, plus
an `ambiguous` flag set when the top candidate is too small or another candidate is
within 10% of its score (the caller should fall back to vision or ask the user).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class BboxResult:
    bbox_norm: tuple[float, float, float, float] | None
    ambiguous: bool
    reason: str
    candidates_count: int


def detect_plan_bbox(image_bgr: np.ndarray) -> BboxResult:
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Otsu inverse threshold -> ink is white (255), paper is black (0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Large morphological closing to merge nearby ink into dense blobs.
    # Kernel size scales with image so it works on previews and full-size.
    kernel_size = max(15, min(h, w) // 60)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return BboxResult(None, ambiguous=True, reason="no_contours", candidates_count=0)

    image_area = float(h * w)
    scored: list[tuple[float, tuple[int, int, int, int], dict]] = []

    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        bbox_area = float(cw * ch)
        if bbox_area < image_area * 0.02:
            continue  # too small
        cnt_area = float(cv2.contourArea(cnt))
        fill_ratio = cnt_area / bbox_area if bbox_area > 0 else 0.0

        # aspect ratio penalty (very thin shapes are usually borders/scales/legends)
        aspect = max(cw, ch) / max(1.0, min(cw, ch))

        # edge distance: penalize blobs flush with image border (often cartouches)
        edge_min = min(x, y, w - (x + cw), h - (y + ch))
        edge_norm = edge_min / max(1.0, min(w, h))

        # score: large area, high fill, away from edge, moderate aspect
        aspect_pen = 1.0 if aspect <= 5 else max(0.2, 5.0 / aspect)
        score = (bbox_area / image_area) * (0.3 + 0.7 * fill_ratio) * (0.5 + 0.5 * min(1.0, edge_norm * 5)) * aspect_pen

        scored.append((score, (x, y, cw, ch), {
            "fill_ratio": fill_ratio,
            "aspect": aspect,
            "edge_norm": edge_norm,
            "bbox_area_frac": bbox_area / image_area,
        }))

    if not scored:
        return BboxResult(None, ambiguous=True, reason="all_too_small", candidates_count=0)

    scored.sort(key=lambda t: t[0], reverse=True)
    top_score, top_bbox, top_meta = scored[0]
    x, y, cw, ch = top_bbox

    # Pad the bbox by 2% to avoid clipping content right at the edge
    pad_x = int(w * 0.02)
    pad_y = int(h * 0.02)
    x0 = max(0, x - pad_x)
    y0 = max(0, y - pad_y)
    x1 = min(w, x + cw + pad_x)
    y1 = min(h, y + ch + pad_y)

    bbox_norm = (x0 / w, y0 / h, x1 / w, y1 / h)

    # Ambiguity: top blob covers <30% of image OR runner-up is within 10% of top.
    ambiguous = False
    reasons = []
    if top_meta["bbox_area_frac"] < 0.30:
        ambiguous = True
        reasons.append(f"small_top_blob({top_meta['bbox_area_frac']:.2%})")
    if len(scored) > 1:
        runner_up = scored[1][0]
        if runner_up >= top_score * 0.9:
            ambiguous = True
            reasons.append(f"close_runner_up({runner_up:.3f}_vs_{top_score:.3f})")

    return BboxResult(
        bbox_norm=bbox_norm,
        ambiguous=ambiguous,
        reason=",".join(reasons) if reasons else "ok",
        candidates_count=len(scored),
    )


def draw_bbox_overlay(image_bgr: np.ndarray, bbox_norm, label: str = "") -> np.ndarray:
    """Return a copy of image with a red rectangle drawn at bbox_norm."""
    out = image_bgr.copy()
    if bbox_norm is None:
        return out
    h, w = out.shape[:2]
    x0, y0, x1, y1 = bbox_norm
    p0 = (int(x0 * w), int(y0 * h))
    p1 = (int(x1 * w), int(y1 * h))
    thickness = max(2, min(h, w) // 400)
    cv2.rectangle(out, p0, p1, (0, 0, 255), thickness)
    if label:
        font_scale = max(0.5, min(h, w) / 1200)
        cv2.putText(
            out, label,
            (p0[0] + 10, p0[1] + max(20, int(font_scale * 30))),
            cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 255), thickness,
        )
    return out
