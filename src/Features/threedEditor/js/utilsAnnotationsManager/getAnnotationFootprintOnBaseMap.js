import { Matrix4, Vector3 } from "three";
import polygonClipping from "polygon-clipping";

import buildAnnotationSolidObjectsAsync from "./buildAnnotationSolidObjectsAsync";
import createBaseMapFrameGroup from "./createBaseMapFrameGroup";

const _v0 = new Vector3();
const _v1 = new Vector3();
const _v2 = new Vector3();

// Local metres of a base map plane -> that map's REFERENCE pixels. Inverse of
// pixelToWorld (centred on the image, y flipped).
function localToPixel(x, y, metrics) {
  return [
    x / metrics.meterByPx + metrics.imageWidth / 2,
    -y / metrics.meterByPx + metrics.imageHeight / 2,
  ];
}

function triangleAreaPx(a, b, c) {
  return (
    Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
  );
}

/**
 * The 2D footprint an annotation's REAL 3D solid casts on another base map's
 * plane, in that map's reference pixels.
 *
 * This is the projection of the MESH, not of the annotation's flat contour:
 * for an opening the hole you see in a wall is the silhouette of its solid,
 * which a contour projection would not give (it ignores the height/thickness
 * the solid actually spans).
 *
 * Every triangle is projected onto the host plane and the silhouette is their
 * exact union — so concave shapes and multi-part solids come out right, and
 * the out-of-plane component is simply dropped (orthographic projection).
 *
 * Display only: the subtraction itself is computed on the 3D geometry.
 *
 * @param {Object} args
 * @param {Object} args.annotation  pixel-resolved annotation (the opening)
 * @param {Object} args.forRender   its own base map metrics (getBaseMapForRender)
 * @param {Object} args.transform   its own base map pose (getBaseMapTransform)
 * @param {Object} args.hostForRender  host base map metrics
 * @param {Object} args.hostTransform  host base map pose
 * @returns {Promise<Array<Array<Array<number>>>|null>} rings [[ [x,y], ... ], ...]
 *   in the HOST base map's reference pixels, or null.
 */
export default async function getAnnotationFootprintOnBaseMap({
  annotation,
  forRender,
  transform,
  hostForRender,
  hostTransform,
}) {
  if (!annotation || !forRender?.meterByPx || !hostForRender?.meterByPx) {
    return null;
  }

  let frame = null;
  try {
    const objects = (
      await buildAnnotationSolidObjectsAsync(annotation, forRender, {
        disableOpacity: true,
      })
    ).filter(Boolean);
    if (objects.length === 0) return null;

    // Put the solid in its own base map's world frame...
    frame = createBaseMapFrameGroup(transform);
    objects.forEach((o) => frame.add(o));
    frame.updateMatrixWorld(true);

    // ...then express everything in the HOST plane's local frame.
    const worldToHost = new Matrix4()
      .copy(createBaseMapFrameGroup(hostTransform).matrixWorld)
      .invert();

    const triangles = [];
    for (const object of objects) {
      object.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        const pos = child.geometry.getAttribute("position");
        if (!pos) return;
        const idx = child.geometry.getIndex();
        const triCount = (idx ? idx.count : pos.count) / 3;
        const toHost = new Matrix4().multiplyMatrices(
          worldToHost,
          child.matrixWorld
        );
        for (let t = 0; t < triCount; t++) {
          const i0 = idx ? idx.getX(t * 3) : t * 3;
          const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
          const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          _v0.fromBufferAttribute(pos, i0).applyMatrix4(toHost);
          _v1.fromBufferAttribute(pos, i1).applyMatrix4(toHost);
          _v2.fromBufferAttribute(pos, i2).applyMatrix4(toHost);
          const a = localToPixel(_v0.x, _v0.y, hostForRender);
          const b = localToPixel(_v1.x, _v1.y, hostForRender);
          const c = localToPixel(_v2.x, _v2.y, hostForRender);
          // Triangles seen edge-on project to a segment: they carry no area
          // and would make the union solver choke.
          if (triangleAreaPx(a, b, c) < 1e-9) continue;
          triangles.push([[a, b, c, a]]);
        }
      });
    }
    if (triangles.length === 0) return null;

    const merged = polygonClipping.union(triangles[0], ...triangles.slice(1));
    if (!merged?.length) return null;

    // MultiPolygon -> flat list of rings (outer + holes), all drawable as-is.
    const rings = [];
    for (const polygon of merged) {
      for (const ring of polygon) if (ring?.length >= 3) rings.push(ring);
    }
    return rings.length > 0 ? rings : null;
  } catch (e) {
    console.error("[getAnnotationFootprintOnBaseMap] failed", e);
    return null;
  } finally {
    frame?.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
