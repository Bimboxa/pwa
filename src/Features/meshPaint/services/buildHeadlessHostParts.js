import { Matrix4 } from "three";

import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import createBaseMapFrameGroup from "Features/threedEditor/js/utilsAnnotationsManager/createBaseMapFrameGroup";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { BRUSH_MAX_HOST_TRIANGLES } from "Features/meshPaint/constants/meshPaintConstants";
import {
  countSolidTriangles,
  getHostPartData,
} from "Features/meshPaint/js/buildHostPartIndexFromObject";

// Paintable parts of a host annotation built OUTSIDE the 3D scene: the same
// builder as the displayed object (createAnnotationObject3D, anti-aliasing
// tweaks off — the scene builds painted hosts without them too), parented
// under a stand-in base map frame (createBaseMapFrameGroup), read by the
// brush's own adapter (getHostPartData: triangles in the base map's LOCAL
// frame, the geometry hash the re-sync compares the paints to).
//
// `annotation` is a RESOLVED annotation (pixel points, flag indices, resolved
// profile lines — resolveAnnotationRowForBuild or useAnnotationsV2 output);
// `baseMap` a BaseMap instance or a plain record (size, scale, pose).
//
// Returns null when the host builds nothing, { tooDense: true } above the
// brush's triangle cap, else { index, hash, matrixWorld (column-major
// elements of the base map frame), triangleCount, dispose() }.

function disposeObject(object) {
  object?.traverse?.((child) => {
    try {
      child.userData?.dispose?.();
    } catch {
      /* ignore */
    }
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material)
      ? child.material
      : child.material
        ? [child.material]
        : [];
    for (const material of materials) material.dispose?.();
  });
}

/**
 * @param {object} args
 * @param {object} args.annotation resolved annotation
 * @param {object} args.baseMap the annotation's base map (BaseMap / record)
 * @param {object} [args.buildOptions] 3D build options (anti-aliasing is
 *   always turned off)
 */
export default function buildHeadlessHostParts({
  annotation,
  baseMap,
  buildOptions,
}) {
  const metrics = getBaseMapForRender(baseMap);
  if (!annotation || !metrics) return null;

  const options = { ...(buildOptions ?? {}), antiAliasingShrink: false };
  let root = null;
  let group = null;
  try {
    root = createAnnotationObject3D(
      { ...annotation, _noAntiAliasingShrink: true },
      metrics,
      options
    );
    if (!root) return null;
    group = createBaseMapFrameGroup(getBaseMapTransform(baseMap));
    group.add(root);
    group.updateMatrixWorld(true);

    const triangleCount = countSolidTriangles(root);
    if (triangleCount > BRUSH_MAX_HOST_TRIANGLES) {
      disposeObject(root);
      return { tooDense: true, triangleCount };
    }
    const data = getHostPartData({ root, group, source: annotation, baseMap });
    if (!data) {
      disposeObject(root);
      return null;
    }
    const index = data.getIndex();
    const matrixWorld = new Matrix4().copy(group.matrixWorld).elements.slice();
    return {
      index,
      hash: data.hash,
      matrixWorld,
      triangleCount,
      dispose: () => disposeObject(root),
    };
  } catch (e) {
    console.error("[buildHeadlessHostParts] build failed", e);
    if (root) disposeObject(root);
    return null;
  }
}
