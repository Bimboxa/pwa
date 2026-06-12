#!/usr/bin/env python3
"""Step 1 - detect structural elements (thick solid strokes) on a 2D plan image.

Structural walls/columns are usually the only THICK solid strokes on a plan.
Two detection modes:
  --mode dark   (default) dark + achromatic pixels (black/grey walls)
  --mode color  pixels close to a target hue (--color "#RRGGBB"), for plans
                where structure is highlighted in a specific color

Outputs in OUTDIR:
  mask.npy / mask.png         binary mask of structural pixels
  step1_overlay_full.png      source image with detected pixels painted red
  step1_overlay_preview.png   downscaled preview (2400px wide)
"""
import argparse
import os

import cv2
import numpy as np


def parse_rect(s):
    v = [float(x) for x in s.split(",")]
    if len(v) != 4:
        raise argparse.ArgumentTypeError("rect must be x0,y0,x1,y1 (normalized 0..1)")
    return v


def load_flattened(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise SystemExit(f"cannot read image: {path}")
    if im.ndim == 2:
        im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    if im.shape[2] == 4:
        alpha = im[:, :, 3:4].astype(np.float32) / 255.0
        im = (im[:, :, :3].astype(np.float32) * alpha + 255.0 * (1 - alpha)).astype(np.uint8)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("outdir")
    ap.add_argument("--mode", choices=["dark", "color"], default="dark")
    ap.add_argument("--gray-max", type=int, default=110, help="dark mode: max grayscale value")
    ap.add_argument("--chroma-max", type=int, default=40, help="dark mode: max chroma (rejects colored networks)")
    ap.add_argument("--color", help="color mode: target hex color, e.g. '#FF0000'")
    ap.add_argument("--hue-tol", type=int, default=14, help="color mode: hue tolerance (0-90)")
    ap.add_argument("--sat-min", type=int, default=60)
    ap.add_argument("--val-min", type=int, default=60)
    ap.add_argument("--close", type=int, default=0,
                    help="pre-close kernel in px to merge hatched poche (diagonal hatch "
                         "between two wall lines) into solid bands before the thickness "
                         "filter; 0 disables (default). Use ~3-7 for fine hatch fills")
    ap.add_argument("--half-thickness", type=float, default=5.0,
                    help="min half-thickness in px: keeps strokes thicker than 2x this value")
    ap.add_argument("--min-area", type=int, default=600, help="min component area in px^2")
    ap.add_argument("--border-trim", type=float, default=0.012,
                    help="normalized margin trimmed on each side (paper frame)")
    ap.add_argument("--exclude", type=parse_rect, action="append", default=[],
                    help="normalized rect x0,y0,x1,y1 to exclude (title block, legend) - repeatable")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    im = load_flattened(args.image)
    H, W = im.shape[:2]

    if args.mode == "dark":
        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        chroma = np.max(im, axis=2).astype(np.int16) - np.min(im, axis=2).astype(np.int16)
        target = ((gray < args.gray_max) & (chroma < args.chroma_max)).astype(np.uint8) * 255
    else:
        if not args.color:
            raise SystemExit("--mode color requires --color '#RRGGBB'")
        hexc = args.color.lstrip("#")
        bgr = np.uint8([[[int(hexc[4:6], 16), int(hexc[2:4], 16), int(hexc[0:2], 16)]]])
        hsv_t = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0, 0]
        hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
        dh = np.abs(hsv[:, :, 0].astype(np.int16) - int(hsv_t[0]))
        dh = np.minimum(dh, 180 - dh)
        target = ((dh <= args.hue_tol) & (hsv[:, :, 1] >= args.sat_min) & (hsv[:, :, 2] >= args.val_min))
        target = target.astype(np.uint8) * 255

    # exclusions: paper frame margins + user rects (title block, legends)
    bt = args.border_trim
    target[: int(bt * H), :] = 0
    target[int((1 - bt) * H):, :] = 0
    target[:, : int(bt * W / 2)] = 0
    target[:, int((1 - bt / 2) * W):] = 0
    for x0, y0, x1, y1 in args.exclude:
        target[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 0

    # pre-close: merge hatched poche (fine diagonal hatch between two wall lines)
    # into solid bands so the thickness filter sees the true wall width, not the
    # ~1px hatch strokes. No-op when --close 0.
    if args.close > 1:
        kc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (args.close, args.close))
        target = cv2.morphologyEx(target, cv2.MORPH_CLOSE, kc)

    # thickness filter: distance transform keeps cores of thick strokes only,
    # then a BOUNDED dilation clipped to the target mask recovers crisp edges
    # (unbounded reconstruction would flood through attached thin lines)
    ht = args.half_thickness
    dist = cv2.distanceTransform(target, cv2.DIST_L2, 5)
    core = (dist >= ht).astype(np.uint8) * 255
    kd = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2 * ht + 3), int(2 * ht + 3)))
    recon = cv2.bitwise_and(cv2.dilate(core, kd), target)
    recon = cv2.morphologyEx(recon, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    n, lab, stats, _ = cv2.connectedComponentsWithStats(recon, 8)
    keep = np.zeros_like(recon)
    kept = 0
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= args.min_area:
            keep[lab == i] = 255
            kept += 1

    np.save(os.path.join(args.outdir, "mask.npy"), keep)
    cv2.imwrite(os.path.join(args.outdir, "mask.png"), keep)
    overlay = im.copy()
    overlay[keep > 0] = (0, 0, 255)
    cv2.imwrite(os.path.join(args.outdir, "step1_overlay_full.png"), overlay)
    pw = min(2400, W)
    prev = cv2.resize(overlay, (pw, int(pw * H / W)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(args.outdir, "step1_overlay_preview.png"), prev)
    print(f"image {W}x{H} | components kept: {kept} | structural px: {int((keep > 0).sum())}")


if __name__ == "__main__":
    main()
