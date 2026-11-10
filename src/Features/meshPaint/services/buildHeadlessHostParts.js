import { Matrix4 } from "three";

import isHollowSubtractionHost from "Features/annotations/utils/isHollowSubtractionHost";
import buildAnnotationSolidObjectsAsync from "Features/threedEditor/js/utilsAnnotationsManager/buildAnnotationSolidObjectsAsync";
import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import createBaseMapFrameGroup from "Features/threedEditor/js/utilsAnnotationsManager/createBaseMapFrameGroup";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import subtractAnnotationGeometries from "Features/threedEditor/js/utilsAnnotationsManager/subtractAnnotationGeometries";
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
//
// A host carved by subtractions (relAnnotationSubtractions) is read CARVED,
// like its displayed object: buildHeadlessCarvedHostParts builds the cutters
// (each in the frame of its own base map) and runs the live carve's own
// boolean before the parts are read — same hollow rule, same operand builder
// as AnnotationsManager.

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

const toBuildOptions = (buildOptions) => ({
  ...(buildOptions ?? {}),
  antiAliasingShrink: false,
});

// The host's object under a stand-in frame of its base map (null when it
// builds nothing).
function createHostRoot({ annotation, baseMap, options }) {
  const metrics = getBaseMapForRender(baseMap);
  if (!annotation || !metrics) return null;
  const root = createAnnotationObject3D(
    { ...annotation, _noAntiAliasingShrink: true },
    metrics,
    options
  );
  if (!root) return null;
  const group = createBaseMapFrameGroup(getBaseMapTransform(baseMap));
  group.add(root);
  group.updateMatrixWorld(true);
  return { root, group };
}

function readHostParts({ root, group, annotation, baseMap }) {
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
  let host = null;
  try {
    host = createHostRoot({
      annotation,
      baseMap,
      options: toBuildOptions(buildOptions),
    });
    if (!host) return null;
    return readHostParts({ ...host, annotation, baseMap });
  } catch (e) {
    console.error("[buildHeadlessHostParts] build failed", e);
    if (host?.root) disposeObject(host.root);
    return null;
  }
}

/**
 * Same as buildHeadlessHostParts for a host carved by subtractions: the
 * cutters are built with the live carve's operand builder
 * (buildAnnotationSolidObjectsAsync: a « Fosse » cuts as its closed prism),
 * each under a stand-in frame of ITS OWN base map, and subtracted from the
 * host before its parts are read (hollow clip for an open-surface host —
 * isHollowSubtractionHost, the live carve's rule).
 *
 * @param {object} args
 * @param {object} args.annotation resolved host annotation
 * @param {object} args.baseMap the host's base map (BaseMap / record)
 * @param {Array<{annotation: object, baseMap: object}>} args.subtractionTargets
 *   resolved cutters, each with its own base map
 * @param {object} [args.buildOptions]
 * @returns {Promise<object|null>} same shape as buildHeadlessHostParts
 */
export async function buildHeadlessCarvedHostParts({
  annotation,
  baseMap,
  subtractionTargets,
  buildOptions,
}) {
  const options = toBuildOptions(buildOptions);
  let host = null;
  const operands = [];
  try {
    host = createHostRoot({ annotation, baseMap, options });
    if (!host) return null;

    for (const target of subtractionTargets ?? []) {
      const metrics = getBaseMapForRender(target?.baseMap);
      if (!target?.annotation || !metrics) continue;
      const objects = await buildAnnotationSolidObjectsAsync(
        target.annotation,
        metrics,
        options
      );
      const frame = createBaseMapFrameGroup(
        getBaseMapTransform(target.baseMap)
      );
      for (const object of (objects ?? []).filter(Boolean)) {
        frame.add(object);
        operands.push(object);
      }
      frame.updateMatrixWorld(true);
    }
    if (operands.length) {
      subtractAnnotationGeometries(host.root, operands, {
        hollow: isHollowSubtractionHost(annotation),
      });
      host.group.updateMatrixWorld(true);
    }
    return readHostParts({ ...host, annotation, baseMap });
  } catch (e) {
    console.error("[buildHeadlessCarvedHostParts] build failed", e);
    if (host?.root) disposeObject(host.root);
    return null;
  } finally {
    operands.forEach(disposeObject);
  }
}
