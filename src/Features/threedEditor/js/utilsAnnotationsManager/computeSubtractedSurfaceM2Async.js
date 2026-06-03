import { Vector3 } from "three";

import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";

import getSolidMeshFromObject3D from "./getSolidMeshFromObject3D";
import buildResolvedSourceObjectAsync from "./buildResolvedSourceObjectAsync";
import buildAnnotationSolidObjectsAsync from "./buildAnnotationSolidObjectsAsync";
import subtractAnnotationGeometries from "./subtractAnnotationGeometries";

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _ab = new Vector3();
const _ac = new Vector3();

// Sum of triangle areas of a BufferGeometry, in the geometry's own units²
// (here basemap-local meters → m²).
function geometryArea(geom) {
  const pos = geom?.getAttribute?.("position");
  if (!pos) return 0;
  const idx = geom.getIndex();
  const triCount = (idx ? idx.count : pos.count) / 3;
  let area = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    _a.fromBufferAttribute(pos, i0);
    _b.fromBufferAttribute(pos, i1);
    _c.fromBufferAttribute(pos, i2);
    _ab.subVectors(_b, _a);
    _ac.subVectors(_c, _a);
    area += _ab.cross(_ac).length() * 0.5;
  }
  return area;
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    try {
      child.userData?.dispose?.();
    } catch {
      /* ignore */
    }
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

/**
 * Headless: build the source's swept surface + the target solids, run the same
 * 3D boolean carve, and return the developed-surface area REMOVED by the
 * subtraction (m²) = uncarved mesh area − carved mesh area.
 *
 * Only meaningful for open-surface (EXTRUSION_PROFILE) sources, whose quantity
 * is a developed/lateral surface (not a planar footprint). Returns null
 * otherwise.
 *
 * @param {Object} sourceAnnotation     pixel-resolved source annotation
 * @param {{imageWidth,imageHeight,meterByPx}} baseMapForRender
 * @param {Array<Object>} targetAnnotations pixel-resolved subtraction targets
 * @returns {Promise<number|null>} removed surface in m², or null
 */
// Module-level memo: the same (host + targets) carve is requested by several
// withQties useAnnotationsV2 instances and across re-renders. Key on the fields
// that affect the geometry (updatedAt is a cheap proxy for any edit).
const _cache = new Map();
const MAX_CACHE = 200;

function cacheKey(source, baseMapForRender, targets) {
  return JSON.stringify({
    s: [source.id, source.updatedAt, source.extrusionOrientation],
    m: baseMapForRender.meterByPx,
    w: baseMapForRender.imageWidth,
    h: baseMapForRender.imageHeight,
    t: targets.map((t) => [t.id, t.updatedAt, t.height]),
  });
}

export default async function computeSubtractedSurfaceM2Async(
  sourceAnnotation,
  baseMapForRender,
  targetAnnotations
) {
  if (getShape3DKey(sourceAnnotation?.shape3D) !== "EXTRUSION_PROFILE") {
    return null;
  }
  if (!targetAnnotations?.length || !baseMapForRender?.meterByPx) return null;

  const key = cacheKey(sourceAnnotation, baseMapForRender, targetAnnotations);
  if (_cache.has(key)) return _cache.get(key);

  let sourceObj = null;
  let targetObjs = [];
  let result = null;
  try {
    sourceObj = await buildResolvedSourceObjectAsync(
      sourceAnnotation,
      baseMapForRender,
      { disableOpacity: true }
    );
    const mesh = sourceObj && getSolidMeshFromObject3D(sourceObj);
    if (!mesh) return null;
    const uncarvedArea = geometryArea(mesh.geometry);
    if (uncarvedArea <= 0) return null;

    targetObjs = (
      await Promise.all(
        targetAnnotations.map((t) =>
          buildAnnotationSolidObjectsAsync(t, baseMapForRender, {
            disableOpacity: true,
          })
        )
      )
    )
      .flat()
      .filter(Boolean);
    if (targetObjs.length === 0) return null;

    // Headless: both source + targets are unparented (matrixWorld = identity),
    // so they share the basemap-local meter frame; the world round-trip is a
    // no-op and the carved geometry stays in meters.
    subtractAnnotationGeometries(sourceObj, targetObjs, { hollow: true });

    const carvedMesh = getSolidMeshFromObject3D(sourceObj);
    const carvedArea = carvedMesh ? geometryArea(carvedMesh.geometry) : uncarvedArea;

    result = Math.max(0, uncarvedArea - carvedArea);
    // Memoize successful results (skip caching on error so it can retry).
    if (_cache.size >= MAX_CACHE) _cache.clear();
    _cache.set(key, result);
    return result;
  } catch (e) {
    console.error("[computeSubtractedSurfaceM2Async] failed", e);
    return null;
  } finally {
    if (sourceObj) disposeObject(sourceObj);
    targetObjs.forEach(disposeObject);
  }
}
