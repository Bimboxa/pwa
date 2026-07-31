import { Group, Vector3 } from "three";

import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";
import getBaseMapTransform, {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";

import { getSolidMeshesFromObject3D } from "./getSolidMeshFromObject3D";
import buildResolvedSourceObjectAsync from "./buildResolvedSourceObjectAsync";
import buildAnnotationSolidObjectsAsync from "./buildAnnotationSolidObjectsAsync";
import subtractAnnotationGeometries from "./subtractAnnotationGeometries";
import getBaseMapForRender from "./getBaseMapForRender";

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

// Put an operand inside a Group carrying its base map's world placement, so
// operands built from DIFFERENT base maps land in a common world frame.
// Parenting (rather than writing onto the object) mirrors the live scene
// exactly — createImageObject builds the Group, AnnotationsManager adds the
// annotation to it — and it composes with whatever local transform the object
// already has instead of overwriting it.
// subtractAnnotationGeometries reads every operand through matrixWorld.
function attachToBaseMapFrame(object, baseMap) {
  if (!object || !baseMap) return;
  const transform = getBaseMapTransform(baseMap);
  const euler = getBaseMapEuler(transform);
  const group = new Group();
  group.rotation.order = BASE_MAP_ROTATION_ORDER;
  group.position.set(
    transform.position.x,
    transform.position.y,
    transform.position.z
  );
  group.rotation.set(euler.x, euler.y, euler.z);
  group.add(object);
  group.updateMatrixWorld(true);
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
 * 3D boolean carve, and return the developed-surface areas (m²): the area
 * REMOVED by the subtraction plus the carved / uncarved mesh triangle-sums it
 * derives from.
 *
 * Normally only meaningful for open-surface (EXTRUSION_PROFILE swept surface,
 * REVOLUTION lathe shell) sources, whose quantity is a developed/lateral
 * surface (not a planar footprint). Returns null otherwise. REVOLUTION
 * sources need `revolutionAxisPoints` already resolved on the annotation.
 *
 * CROSS-BASEMAP: when a target lives on another base map, the planar
 * (polygon-clipping) path cannot be used at all — the two pixel frames are
 * unrelated — so this becomes the only valid quantity for ANY source shape,
 * and the shape gate is lifted. Each operand is then built with its own base
 * map's metrics and given that base map's world pose, so the boolean resolves
 * in a common world frame.
 *
 * @param {Object} sourceAnnotation     pixel-resolved source annotation
 * @param {{imageWidth,imageHeight,meterByPx}} baseMapForRender  source metrics
 * @param {Array<Object>} targetAnnotations pixel-resolved subtraction targets
 * @param {Object} [options]
 * @param {string} [options.sourceBaseMapId]
 * @param {Object} [options.baseMapsById] {[baseMapId]: baseMap record} — needed
 *   only when a target sits on a base map other than the source's.
 * @returns {Promise<{removedM2:number, carvedM2:number, uncarvedM2:number}|null>}
 */
// Module-level memo: the same (host + targets) carve is requested by several
// withQties useAnnotationsV2 instances and across re-renders. Key on the fields
// that affect the geometry (updatedAt is a cheap proxy for any edit).
const _cache = new Map();
const MAX_CACHE = 200;

// Pose fields that change the world placement of a cross-basemap operand, so a
// base map moved in the 3D editor invalidates the memo.
function baseMapKeyPart(baseMap) {
  if (!baseMap) return null;
  const t = getBaseMapTransform(baseMap);
  return [
    baseMap.meterByPx,
    t.orientation,
    t.angleDeg,
    t.position.x,
    t.position.y,
    t.position.z,
  ];
}

function cacheKey(source, baseMapForRender, targets, crossBaseMaps) {
  return JSON.stringify({
    s: [source.id, source.updatedAt, source.extrusionOrientation],
    // REVOLUTION radius depends on the axis line, whose edits don't touch the
    // arc's own updatedAt — key on the resolved axis coordinates.
    a: (source.revolutionAxisPoints || []).map((p) => [p.x, p.y]),
    m: baseMapForRender.meterByPx,
    w: baseMapForRender.imageWidth,
    h: baseMapForRender.imageHeight,
    o: baseMapForRender.orientation,
    t: targets.map((t) => [t.id, t.updatedAt, t.height, t.baseMapId]),
    // null in the same-basemap case, so existing keys keep their shape.
    x: crossBaseMaps,
  });
}

export default async function computeSubtractedSurfaceM2Async(
  sourceAnnotation,
  baseMapForRender,
  targetAnnotations,
  options = {}
) {
  if (!targetAnnotations?.length || !baseMapForRender?.meterByPx) return null;

  const { sourceBaseMapId, baseMapsById } = options;
  // A target on another base map makes the planar path impossible, so the
  // mesh area becomes the only quantity — whatever the source's shape.
  const isCrossBaseMap = Boolean(
    sourceBaseMapId &&
      targetAnnotations.some(
        (t) => t?.baseMapId && t.baseMapId !== sourceBaseMapId
      )
  );

  const shapeKey = getShape3DKey(sourceAnnotation?.shape3D);
  if (
    !isCrossBaseMap &&
    !["EXTRUSION_PROFILE", "REVOLUTION"].includes(shapeKey)
  ) {
    return null;
  }

  const crossBaseMaps = isCrossBaseMap
    ? [
        baseMapKeyPart(baseMapsById?.[sourceBaseMapId]),
        ...targetAnnotations.map((t) =>
          baseMapKeyPart(baseMapsById?.[t?.baseMapId])
        ),
      ]
    : null;

  const key = cacheKey(
    sourceAnnotation,
    baseMapForRender,
    targetAnnotations,
    crossBaseMaps
  );
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
    const meshes = sourceObj ? getSolidMeshesFromObject3D(sourceObj) : [];
    if (meshes.length === 0) return null;
    const sumArea = (list) =>
      list.reduce((s, m) => s + geometryArea(m.geometry), 0);
    const uncarvedArea = sumArea(meshes);
    if (uncarvedArea <= 0) return null;

    targetObjs = (
      await Promise.all(
        targetAnnotations.map((t) => {
          // Cross-basemap: build each target with ITS OWN metrics, otherwise a
          // foreign target would be sized with the source's scale.
          const forRender = isCrossBaseMap
            ? (getBaseMapForRender(baseMapsById?.[t?.baseMapId]) ??
              baseMapForRender)
            : baseMapForRender;
          return buildAnnotationSolidObjectsAsync(t, forRender, {
            disableOpacity: true,
          }).then((objects) =>
            (objects ?? [])
              .filter(Boolean)
              .map((o) => ({ object: o, baseMapId: t?.baseMapId }))
          );
        })
      )
    ).flat();
    if (targetObjs.length === 0) return null;

    if (isCrossBaseMap) {
      // Operands come from different base maps, so the basemap-local frames
      // don't coincide: give each one its base map's world pose. The poses are
      // rigid (rotation + translation), so the triangle-area sums below are
      // unaffected; only the relative placement of the operands changes.
      attachToBaseMapFrame(sourceObj, baseMapsById?.[sourceBaseMapId]);
      targetObjs.forEach(({ object, baseMapId }) =>
        attachToBaseMapFrame(object, baseMapsById?.[baseMapId])
      );
    }
    // Same-basemap: both sides stay unparented (matrixWorld = identity), so they
    // share the basemap-local meter frame; the world round-trip is a no-op and
    // the carved geometry stays in meters.
    subtractAnnotationGeometries(
      sourceObj,
      targetObjs.map((t) => t.object),
      { hollow: true }
    );

    const carvedMeshes = getSolidMeshesFromObject3D(sourceObj);
    const carvedArea =
      carvedMeshes.length > 0 ? sumArea(carvedMeshes) : uncarvedArea;

    result = {
      removedM2: Math.max(0, uncarvedArea - carvedArea),
      carvedM2: carvedArea,
      uncarvedM2: uncarvedArea,
    };
    // Memoize successful results (skip caching on error so it can retry).
    if (_cache.size >= MAX_CACHE) _cache.clear();
    _cache.set(key, result);
    return result;
  } catch (e) {
    console.error("[computeSubtractedSurfaceM2Async] failed", e);
    return null;
  } finally {
    if (sourceObj) disposeObject(sourceObj);
    targetObjs.forEach((t) => disposeObject(t?.object));
  }
}
