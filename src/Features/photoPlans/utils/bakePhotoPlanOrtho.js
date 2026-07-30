import applyPhotoPlanHomography from "./applyPhotoPlanHomography";

// Bake the rectified ("mise à plat") orthophoto of a calibrated photoPlan:
// warp the photo through the inverse homography into the plane's metric
// frame, clipped to the source polygon. Browser-only (canvas).
//
// Output frame: x right = +u, y DOWN = -v (image convention), 1 px =
// 1/pxPerM meters. Returns null when the zone is unusable, else
//   { dataUrl, widthPx, heightPx, widthM, heightM, pxPerM }.

const MAX_DIM_PX = 2048;
const MIN_PX_PER_M = 20;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("photo load failed"));
    img.src = url;
  });
}

export default async function bakePhotoPlanOrtho({
  imageUrl,
  imageSize,
  calibration,
  ringPx,
  holesPx = [],
}) {
  if (!imageUrl || !calibration?.ok || !calibration.H || !calibration.Hinv) {
    return null;
  }
  const W0 = imageSize?.width;
  const H0 = imageSize?.height;
  if (!W0 || !H0 || !ringPx || ringPx.length < 3) return null;

  // Zone ring in the plane's metric frame (u right, v up).
  const ringUV = [];
  for (const p of ringPx) {
    const uv = applyPhotoPlanHomography(calibration.H, {
      x: p.x / W0,
      y: p.y / H0,
    });
    if (!uv) return null; // zone crosses the horizon
    ringUV.push(uv);
  }
  const holesUV = [];
  for (const hole of holesPx) {
    const h = [];
    for (const p of hole) {
      const uv = applyPhotoPlanHomography(calibration.H, {
        x: p.x / W0,
        y: p.y / H0,
      });
      if (!uv) return null;
      h.push(uv);
    }
    holesUV.push(h);
  }

  const uMin = Math.min(...ringUV.map((p) => p.x));
  const uMax = Math.max(...ringUV.map((p) => p.x));
  const vMin = Math.min(...ringUV.map((p) => p.y));
  const vMax = Math.max(...ringUV.map((p) => p.y));
  const widthM = uMax - uMin;
  const heightM = vMax - vMin;
  if (!(widthM > 0) || !(heightM > 0)) return null;

  // Resolution: match the photo's own density at the zone center (px per
  // meter along u), clamped so the output stays reasonable.
  const center = { x: (uMin + uMax) / 2, y: (vMin + vMax) / 2 };
  const c0 = applyPhotoPlanHomography(calibration.Hinv, center);
  const c1 = applyPhotoPlanHomography(calibration.Hinv, {
    x: center.x + 1,
    y: center.y,
  });
  let pxPerM =
    c0 && c1
      ? Math.hypot((c1.x - c0.x) * W0, (c1.y - c0.y) * H0)
      : MAX_DIM_PX / Math.max(widthM, heightM);
  pxPerM = Math.max(
    MIN_PX_PER_M,
    Math.min(pxPerM, MAX_DIM_PX / Math.max(widthM, heightM))
  );

  const outW = Math.max(2, Math.round(widthM * pxPerM));
  const outH = Math.max(2, Math.round(heightM * pxPerM));

  // Source pixels.
  const img = await loadImage(imageUrl);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = W0;
  srcCanvas.height = H0;
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.drawImage(img, 0, 0, W0, H0);
  const src = srcCtx.getImageData(0, 0, W0, H0).data;

  // Per-pixel inverse mapping (output (u,v) -> photo px), bilinear sampling.
  const out = new ImageData(outW, outH);
  const dst = out.data;
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = calibration.Hinv;
  for (let row = 0; row < outH; row++) {
    const v = vMax - (row + 0.5) / pxPerM;
    for (let col = 0; col < outW; col++) {
      const u = uMin + (col + 0.5) / pxPerM;
      const w = h6 * u + h7 * v + h8;
      if (Math.abs(w) < 1e-12) continue;
      const nx = (h0 * u + h1 * v + h2) / w;
      const ny = (h3 * u + h4 * v + h5) / w;
      const sx = nx * W0 - 0.5;
      const sy = ny * H0 - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= W0 - 1 || y0 >= H0 - 1) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = 4 * (y0 * W0 + x0);
      const i10 = i00 + 4;
      const i01 = i00 + 4 * W0;
      const i11 = i01 + 4;
      const di = 4 * (row * outW + col);
      for (let ch = 0; ch < 3; ch++) {
        dst[di + ch] =
          src[i00 + ch] * (1 - fx) * (1 - fy) +
          src[i10 + ch] * fx * (1 - fy) +
          src[i01 + ch] * (1 - fx) * fy +
          src[i11 + ch] * fx * fy;
      }
      dst[di + 3] = 255;
    }
  }

  const tmp = document.createElement("canvas");
  tmp.width = outW;
  tmp.height = outH;
  tmp.getContext("2d").putImageData(out, 0, 0);

  // Clip to the zone polygon (putImageData ignores clips; drawImage honors
  // them) — the mask is the polygon itself, holes via even-odd.
  const final = document.createElement("canvas");
  final.width = outW;
  final.height = outH;
  const ctx = final.getContext("2d");
  const toOut = (p) => [(p.x - uMin) * pxPerM, (vMax - p.y) * pxPerM];
  const path = new Path2D();
  ringUV.forEach((p, i) => {
    const [x, y] = toOut(p);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.closePath();
  holesUV.forEach((h) => {
    h.forEach((p, i) => {
      const [x, y] = toOut(p);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
  });
  ctx.clip(path, "evenodd");
  ctx.drawImage(tmp, 0, 0);

  return {
    dataUrl: final.toDataURL("image/png"),
    widthPx: outW,
    heightPx: outH,
    widthM,
    heightM,
    pxPerM,
  };
}
