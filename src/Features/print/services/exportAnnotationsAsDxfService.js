import {
  DxfWriter,
  point2d,
  point3d,
  Units,
  LWPolylineFlags,
  TrueColor,
} from "@tarikjabiri/dxf";

import { getAnnotationRingClosed } from "Features/annotations/utils/segmentFlags";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import downloadBlob from "Features/files/utils/downloadBlob";
import {
  buildBaseMapSnapshotBlob,
  getBaseMapBlob,
} from "Features/assistantRelay/services/buildBaseMapSnapshotImage";

import JSZip from "jszip";

// Exports the active base map's annotations as a DXF file (model space).
// Coordinates: resolved pixel space (useAnnotationsV2 output — never raw db
// rows, their point refs are unresolved) → meters via baseMap.getMeterByPx(),
// Y flipped (px is Y-down, DXF model space is Y-up). Falls back to raw pixels
// (unitless) when the base map has no scale.
// One DXF layer per listing; exact template colors as entity TrueColor.
// Base map picture: a DXF cannot embed a raster — the IMAGE entity points to
// an external file by its bare file name, so the DXF and the picture are
// downloaded together in a flat .zip (AutoCAD resolves a bare name from the
// drawing's folder once unzipped).

// Line-drawn types (color = strokeColor first) vs surface/point types
// (fillColor first) — same visible-color rule as the 2D renderers.
const LINE_TYPES = ["POLYLINE", "STRIP", "RULER", "COTE", "LINEAR_LAYOUT"];

// Types with no DXF mapping in v1 (bubbles, images, 3D objects, axes).
const SKIPPED_TYPES = [
  "DETAIL",
  "IMAGE",
  "OBJECT_3D",
  "TEXT",
  "REVOLUTION_AXIS",
  "REVOLUTION_AXIS_PLACEMENT",
  "BASE_MAP_LINK",
  "DISC",
];

const FALLBACK_LAYER_NAME = "Annotations";
const BASE_MAP_LAYER_NAME = "Fond de plan";

// Re-rendered picture: long edge cap (Safari canvas limit). Only the pixel
// resolution changes, the picture keeps its full size in model space.
const IMAGE_MAX_LONG_EDGE = 8192;
const IMAGE_JPEG_QUALITY = 0.92;

// Raster formats CAD viewers read — anything else is re-rendered as JPEG.
const IMAGE_EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

// CLASS records the raster objects need (the lib writes an empty CLASSES
// section): [dxfName, cppName, appName, proxyFlags, wasProxy, isEntity] —
// same values as ezdxf.
const RASTER_CLASSES = [
  ["IMAGE", "AcDbRasterImage", "ISM", 2175, 0, 1],
  ["IMAGEDEF", "AcDbRasterImageDef", "ISM", 0, 0, 0],
  ["IMAGEDEF_REACTOR", "AcDbRasterImageDefReactor", "ISM", 1, 0, 0],
];

// Basic ACI palette (1-7) for the layer color — entities carry the exact
// TrueColor, the ACI is only the layer's own display color.
const BASIC_ACI_RGB = [
  [1, [255, 0, 0]],
  [2, [255, 255, 0]],
  [3, [0, 255, 0]],
  [4, [0, 255, 255]],
  [5, [0, 0, 255]],
  [6, [255, 0, 255]],
  [7, [255, 255, 255]],
];

function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToNearestBasicAci(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 7;
  let best = 7;
  let bestDist = Infinity;
  BASIC_ACI_RGB.forEach(([aci, ref]) => {
    const dist =
      (rgb[0] - ref[0]) ** 2 + (rgb[1] - ref[1]) ** 2 + (rgb[2] - ref[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = aci;
    }
  });
  return best;
}

function hexToTrueColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  return TrueColor.fromRGB(rgb[0], rgb[1], rgb[2]);
}

function sanitizeLayerName(name) {
  const cleaned = (name ?? "")
    .replace(/[<>/\\":;?*|=`,]/g, "_")
    .trim()
    .slice(0, 200);
  return cleaned || FALLBACK_LAYER_NAME;
}

function sanitizeFileName(name) {
  const cleaned = (name ?? "")
    .replace(/[<>/\\":;?*|]/g, "_")
    .trim()
    .slice(0, 120);
  return cleaned || "plan";
}

function getVisibleColor(annotation) {
  return LINE_TYPES.includes(annotation.type)
    ? annotation.strokeColor || annotation.fillColor
    : annotation.fillColor || annotation.strokeColor;
}

function isResolvedPoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isIdentityTransform(t) {
  return (
    (t?.x ?? 0) === 0 &&
    (t?.y ?? 0) === 0 &&
    (t?.rotation ?? 0) === 0 &&
    (t?.scale ?? 1) === 1
  );
}

// Picture of the base map covering exactly the reference frame
// (getImageSize() = the resolved annotations' pixel space). The original
// bytes when the active version already fills that frame 1:1, else the
// version placed in the frame by buildBaseMapSnapshotBlob.
// → {blob, ext, width, height} (width/height = the picture's own pixels)
async function getBaseMapImageForDxf(baseMap, imageSize) {
  if (isIdentityTransform(baseMap.getActiveVersionTransform?.())) {
    const blob = await getBaseMapBlob(baseMap);
    const ext = IMAGE_EXT_BY_MIME[blob.type];
    if (ext) {
      const bitmap = await createImageBitmap(blob);
      const { width, height } = bitmap;
      bitmap.close?.();
      if (width === imageSize.width && height === imageSize.height) {
        return { blob, ext, width, height };
      }
    }
  }
  const { blob, width, height } = await buildBaseMapSnapshotBlob({
    baseMap,
    maxLongEdge: IMAGE_MAX_LONG_EDGE,
    jpegQuality: IMAGE_JPEG_QUALITY,
    mime: "image/jpeg",
  });
  return { blob, ext: "jpg", width, height };
}

// IMAGE entity + the two fixes its lib output needs to load in AutoCAD: the
// CLASS records, and the IMAGEDEF_REACTOR owner (written as 0 by the lib,
// must be the IMAGE).
function addRasterImage(dxf, { path, width, height, modelWidth, layerName }) {
  const imageEntity = dxf.addImage(
    path,
    "fond_de_plan",
    point3d(0, 0, 0),
    width,
    height,
    modelWidth,
    0,
    { layerName }
  );
  const reactor = dxf.document.objects.objects.find(
    (o) => o.handle === imageEntity.imageDefReactorHandle
  );
  if (reactor) reactor.ownerObjecthandle = imageEntity.handle;

  dxf.document.classes.dxfy = (dx) => {
    dx.start("CLASSES");
    RASTER_CLASSES.forEach(
      ([dxfName, cppName, appName, proxyFlags, wasProxy, isEntity]) => {
        dx.push(0, "CLASS");
        dx.push(1, dxfName);
        dx.push(2, cppName);
        dx.push(3, appName);
        dx.push(90, proxyFlags);
        dx.push(91, 0);
        dx.push(280, wasProxy);
        dx.push(281, isEntity);
      }
    );
    dx.end();
  };
}

export default async function exportAnnotationsAsDxf({
  annotations,
  baseMap,
  includeBaseMapImage = true,
}) {
  const imageSize = baseMap?.getImageSize?.() ?? baseMap?.image?.imageSize;
  if (!imageSize?.height) return null;

  const meterByPx = baseMap.getMeterByPx?.() ?? null;
  const k = meterByPx ?? 1; // drawing unit = meter when scaled, pixel otherwise
  const H = imageSize.height;

  // px (Y-down) → model space (Y-up)
  const toVertex = (p) => ({ point: point2d(p.x * k, (H - p.y) * k) });
  const toPoint3d = (p) => point3d(p.x * k, (H - p.y) * k, 0);

  const pointRadius = meterByPx ? 0.05 : 5;
  const textHeight = meterByPx ? 0.2 : 14;

  const validAnnotations = (annotations ?? []).filter(
    // The resolve pass can emit stray [] rows when a base map lacks imageSize.
    (a) => a && !Array.isArray(a) && a.type && !SKIPPED_TYPES.includes(a.type)
  );

  const dxf = new DxfWriter();
  dxf.setUnits(meterByPx ? Units.Meters : Units.Unitless);

  const baseName = sanitizeFileName(baseMap.name);
  const usedLayerNames = new Set();

  // Base map picture first → drawn under the annotations. Its bottom-left
  // corner is the px (0, H) → (0, 0) corner of toVertex; the lib's `scale`
  // (modelWidth) is the picture's full width in drawing units.
  let image = null;
  if (includeBaseMapImage) {
    try {
      image = await getBaseMapImageForDxf(baseMap, imageSize);
    } catch (e) {
      console.warn("[exportAnnotationsAsDxf] base map image skipped", e);
    }
  }
  const imageFileName = image ? `${baseName}.${image.ext}` : null;
  if (image) {
    dxf.addLayer(BASE_MAP_LAYER_NAME, 7);
    usedLayerNames.add(BASE_MAP_LAYER_NAME);
    addRasterImage(dxf, {
      path: imageFileName,
      width: image.width,
      height: image.height,
      modelWidth: imageSize.width * k,
      layerName: BASE_MAP_LAYER_NAME,
    });
  }

  // One layer per listing name (sanitized + deduped), ACI color from the
  // listing's first annotation.
  const layerNameByListing = new Map(); // raw listingName → dxf layer name
  validAnnotations.forEach((a) => {
    const raw = a.listingName || FALLBACK_LAYER_NAME;
    if (layerNameByListing.has(raw)) return;
    let name = sanitizeLayerName(raw);
    let i = 2;
    while (usedLayerNames.has(name)) name = `${sanitizeLayerName(raw)}-${i++}`;
    usedLayerNames.add(name);
    layerNameByListing.set(raw, name);
    dxf.addLayer(name, hexToNearestBasicAci(getVisibleColor(a)));
  });

  let exported = 0;
  let skipped = (annotations?.length ?? 0) - validAnnotations.length;

  validAnnotations.forEach((a) => {
    const layerName = layerNameByListing.get(
      a.listingName || FALLBACK_LAYER_NAME
    );
    const trueColor = hexToTrueColor(getVisibleColor(a));
    const opts = { layerName, trueColor };

    const addRing = (pts, closed) => {
      const resolved = (pts ?? []).filter(isResolvedPoint);
      if (resolved.length < 2) return false;
      dxf.addLWPolyline(resolved.map(toVertex), {
        ...opts,
        flags: closed ? LWPolylineFlags.Closed : LWPolylineFlags.None,
      });
      return true;
    };

    const addCutRings = (cuts) => {
      (cuts ?? []).forEach((cut) => addRing(cut.points, true));
    };

    const addText = (point, value) => {
      if (!isResolvedPoint(point) || !value) return false;
      dxf.addText(toPoint3d(point), textHeight, String(value), opts);
      return true;
    };

    let done = false;
    switch (a.type) {
      case "POLYGON": {
        done = addRing(a.points, true);
        // Holes exported as extra closed rings on the same layer (no HATCH
        // subtraction in v1).
        if (done) addCutRings(a.cuts);
        break;
      }
      case "RECTANGLE": {
        const { x, y, width, height } = a.bbox ?? {};
        if ([x, y, width, height].every(Number.isFinite)) {
          done = addRing(
            [
              { x, y },
              { x: x + width, y },
              { x: x + width, y: y + height },
              { x, y: y + height },
            ],
            true
          );
        }
        break;
      }
      case "POLYLINE": {
        done = addRing(a.points, getAnnotationRingClosed(a));
        if (done) addCutRings(a.cuts);
        break;
      }
      case "STRIP": {
        // Band outline computed in the PIXEL domain (getStripePolygons
        // converts CM widths itself with meterByPx), then transformed.
        const shapes = getStripePolygons(a, meterByPx, true);
        shapes.forEach((shape) => {
          if (addRing(shape.points, true)) done = true;
          addCutRings(shape.cuts);
        });
        break;
      }
      case "RULER":
      case "COTE":
      case "LINEAR_LAYOUT": {
        done = addRing(a.points, false);
        break;
      }
      case "POINT":
      case "MARKER": {
        if (isResolvedPoint(a.point)) {
          // CIRCLE rather than a DXF POINT entity (near-invisible in most
          // viewers).
          dxf.addCircle(toPoint3d(a.point), pointRadius, opts);
          done = true;
        }
        break;
      }
      case "FREE_TEXT": {
        done = addText(a.labelPoint ?? a.targetPoint, a.textContent);
        break;
      }
      case "LABEL": {
        done = addText(a.labelPoint ?? a.targetPoint, getAnnotationOwnLabel(a));
        break;
      }
      default:
        break;
    }

    // Visible label of a geometry annotation → TEXT on the same layer.
    if (done && !["FREE_TEXT", "LABEL"].includes(a.type)) {
      const labelProps = getAnnotationLabelPropsFromAnnotation(a);
      if (labelProps && !labelProps.hidden) {
        // lines = [{kind, text}] (getAnnotationLabelTextLines)
        const lines = (labelProps.lines ?? [])
          .map((line) => line?.text)
          .filter(Boolean);
        const text = lines.length > 0 ? lines.join(" ") : labelProps.label;
        addText(labelProps.labelPoint, text);
      }
    }

    if (done) exported += 1;
    else skipped += 1;
  });

  const dxfString = dxf.stringify();

  if (image) {
    // Flat zip: the IMAGE entity references the picture by its bare name.
    const zip = new JSZip();
    zip.file(`${baseName}.dxf`, dxfString);
    zip.file(imageFileName, await image.blob.arrayBuffer());
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `${baseName}.zip`);
  } else {
    const dxfBlob = new Blob([dxfString], { type: "application/dxf" });
    downloadBlob(dxfBlob, `${baseName}.dxf`);
  }

  return { exported, skipped, withImage: Boolean(image) };
}
