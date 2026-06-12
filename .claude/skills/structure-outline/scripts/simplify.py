#!/usr/bin/env python3
"""Steps 2+3 - contour the structural mask, then smooth/simplify the polylines.

Reads OUTDIR/mask.npy produced by detect.py.

Step 2: extract outer contours + holes (RETR_CCOMP).
Step 3: Douglas-Peucker simplification + orthogonal straightening of
        near-axial segments + collinear vertex removal. Small rectangular
        components are recognized as columns and replaced by perfect
        4-point rectangles.

Outputs in OUTDIR:
  polys.json                  [{kind: wall|column, hole: bool, pts: [[x,y]px]}]
  step2_contours_full.png / step2_contours_preview.png
  step3_simplified_full.png / step3_simplified_preview.png
"""
import argparse
import json
import os

import cv2
import numpy as np


def snap_ortho(pts, tol):
    """Straighten near-axial segments of a closed polygon."""
    pts = pts.astype(np.float64).copy()
    n = len(pts)
    for _ in range(3):
        for i in range(n):
            j = (i + 1) % n
            dx, dy = pts[j] - pts[i]
            if abs(dy) <= tol and abs(dx) > abs(dy):
                ymean = (pts[i][1] + pts[j][1]) / 2
                pts[i][1] = pts[j][1] = ymean
            elif abs(dx) <= tol and abs(dy) > abs(dx):
                xmean = (pts[i][0] + pts[j][0]) / 2
                pts[i][0] = pts[j][0] = xmean
    return pts


def drop_collinear(pts, ang_tol_deg, min_seg=3.0):
    out = []
    n = len(pts)
    for i in range(n):
        p0, p1, p2 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n]
        v1, v2 = p1 - p0, p2 - p1
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        if l1 < min_seg and len(out) > 0:
            continue
        if l1 > 0 and l2 > 0:
            cosang = np.clip(np.dot(v1, v2) / (l1 * l2), -1, 1)
            if np.degrees(np.arccos(cosang)) < ang_tol_deg:
                continue
        out.append(p1)
    return np.array(out) if len(out) >= 3 else pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("outdir")
    ap.add_argument("--epsilon", type=float, default=2.5, help="Douglas-Peucker tolerance in px")
    ap.add_argument("--ortho-tol", type=float, default=4.0, help="max px deviation to straighten a segment")
    ap.add_argument("--angle-tol", type=float, default=4.0, help="collinearity angle tolerance in degrees")
    ap.add_argument("--min-contour-area", type=int, default=400)
    ap.add_argument("--column-max-area", type=int, default=9000,
                    help="components smaller than this AND rectangular are treated as columns")
    ap.add_argument("--rect-fill-min", type=float, default=0.72,
                    help="min area/minAreaRect ratio to qualify as a column")
    args = ap.parse_args()

    mask = np.load(os.path.join(args.outdir, "mask.npy"))
    H, W = mask.shape
    im = cv2.imread(os.path.join(args.outdir, "step1_overlay_full.png"))
    src = cv2.imread(args.image, cv2.IMREAD_UNCHANGED)
    if src is not None:
        if src.ndim == 2:
            src = cv2.cvtColor(src, cv2.COLOR_GRAY2BGR)
        if src.shape[2] == 4:
            a = src[:, :, 3:4].astype(np.float32) / 255.0
            src = (src[:, :, :3].astype(np.float32) * a + 255.0 * (1 - a)).astype(np.uint8)
        im = src

    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    # step 2: raw contours
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    hier = hier[0] if hier is not None else []
    bg = cv2.addWeighted(im, 0.35, np.full_like(im, 255), 0.65, 0)
    step2 = bg.copy()
    raw = []
    for i, c in enumerate(cnts):
        if cv2.contourArea(c) < args.min_contour_area:
            continue
        is_hole = hier[i][3] != -1
        raw.append((c, is_hole))
        cv2.drawContours(step2, [c], -1, (255, 0, 200) if is_hole else (0, 0, 255), 3)
    cv2.imwrite(os.path.join(args.outdir, "step2_contours_full.png"), step2)
    pw = min(2400, W)
    cv2.imwrite(os.path.join(args.outdir, "step2_contours_preview.png"),
                cv2.resize(step2, (pw, int(pw * H / W)), interpolation=cv2.INTER_AREA))

    # step 3: simplify
    polys = []
    for c, is_hole in raw:
        area = cv2.contourArea(c)
        rect = cv2.minAreaRect(c)
        rw, rh = rect[1]
        rect_area = rw * rh if rw and rh else 1
        if area < args.column_max_area and area / rect_area > args.rect_fill_min and not is_hole:
            ang = rect[2] % 90
            if ang < 7 or ang > 83:
                x, y, w, h = cv2.boundingRect(c)
                pts = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], np.float64)
            else:
                pts = cv2.boxPoints(rect).astype(np.float64)
            polys.append((pts, is_hole, "column"))
            continue
        ap_ = cv2.approxPolyDP(c, args.epsilon, True).reshape(-1, 2).astype(np.float64)
        ap_ = snap_ortho(ap_, args.ortho_tol)
        ap_ = drop_collinear(ap_, args.angle_tol)
        polys.append((ap_, is_hole, "wall"))

    step3 = bg.copy()
    for pts, is_hole, kind in polys:
        pp = pts.astype(np.int32).reshape(-1, 1, 2)
        col = (255, 0, 200) if is_hole else ((0, 140, 255) if kind == "column" else (0, 0, 255))
        cv2.polylines(step3, [pp], True, col, 3)
        for p in pts.astype(np.int32):
            cv2.circle(step3, tuple(p), 7, (180, 0, 0), -1)
    cv2.imwrite(os.path.join(args.outdir, "step3_simplified_full.png"), step3)
    cv2.imwrite(os.path.join(args.outdir, "step3_simplified_preview.png"),
                cv2.resize(step3, (pw, int(pw * H / W)), interpolation=cv2.INTER_AREA))

    with open(os.path.join(args.outdir, "polys.json"), "w") as f:
        json.dump({"imageWidth": W, "imageHeight": H,
                   "polys": [{"kind": k, "hole": bool(h), "pts": p.tolist()} for p, h, k in polys]}, f)
    n_cols = sum(1 for _, _, k in polys if k == "column")
    n_holes = sum(1 for _, h, _ in polys if h)
    total = sum(len(p) for p, _, _ in polys)
    print(f"polys: {len(polys)} (walls: {len(polys) - n_cols - n_holes}, columns: {n_cols}, "
          f"holes: {n_holes}) | total points: {total}")


if __name__ == "__main__":
    main()
