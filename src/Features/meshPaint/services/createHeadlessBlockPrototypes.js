import { Matrix4 } from "three";

import createAnnotationObject3D from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import createBaseMapFrameGroup from "Features/threedEditor/js/utilsAnnotationsManager/createBaseMapFrameGroup";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import {
  createBlockContentGroup,
  getBlockInverseMatrix,
} from "Features/threedEditor/js/utilsBlocksManager/blockFrame";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { BRUSH_MAX_HOST_TRIANGLES } from "Features/meshPaint/constants/meshPaintConstants";
import {
  countSolidTriangles,
  getHostPartData,
} from "Features/meshPaint/js/buildHostPartIndexFromObject";

// Paintable parts of the INSTANCES of a block (Features/blocks) built OUTSIDE
// the 3D scene — the headless twin of BlocksManager, for services that paint
// a block instance from the database (procedure-driven metering).
//
// The members of the block are built once (createAnnotationObject3D, each in
// the frame of its own blocks base map — the off-scene prototypes); every
// instance is then the scene's placeholder (createAnnotationObject3D, case
// BLOCK_INSTANCE) filled with clones of those prototypes through the shared
// block frame helpers (utilsBlocksManager/blockFrame.js), parented under a
// stand-in frame of the instance's base map and read by the brush's own
// adapter (getHostPartData): same triangles, same geometry hash as the
// displayed instance — the re-sync of a paint hosted by the instance compares
// the two.
//
// Inputs are RESOLVED rows (pixel geometry: resolveAnnotationRowForBuild for
// the members, a pixel `bbox` for an instance) and BaseMap instances or plain
// records (size, scale, pose).
//
// Returns null when the block has no origin or builds nothing, else
// { buildInstance({ instance, baseMap }), dispose() } where buildInstance
// returns null, { tooDense: true } above the brush's triangle cap, or
// { index, hash, matrixWorld (column-major elements of the instance's base
// map frame), triangleCount }.

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
 * @param {{origin: {baseMapId, x, y, z}}} args.block db.blocks row
 * @param {object} args.originBaseMap the block's origin blocks base map
 * @param {Array<{annotation: object, baseMap: object}>} args.members resolved
 *   member annotations, each with its own blocks base map
 * @param {object} [args.buildOptions] 3D build options (anti-aliasing is
 *   always turned off)
 */
export default function createHeadlessBlockPrototypes({
  block,
  originBaseMap,
  members,
  buildOptions,
}) {
  const origin = block?.origin;
  const originMetrics = getBaseMapForRender(originBaseMap);
  if (!origin?.baseMapId || !originMetrics) return null;

  const options = { ...(buildOptions ?? {}), antiAliasingShrink: false };
  const frames = new Map(); // blocks baseMapId → frame group
  const getFrame = (baseMap) => {
    if (!frames.has(baseMap.id)) {
      frames.set(
        baseMap.id,
        createBaseMapFrameGroup(getBaseMapTransform(baseMap))
      );
    }
    return frames.get(baseMap.id);
  };

  const prototypes = [];
  for (const member of members ?? []) {
    const metrics = getBaseMapForRender(member?.baseMap);
    if (!member?.annotation || !metrics) continue;
    try {
      const root = createAnnotationObject3D(
        { ...member.annotation, _noAntiAliasingShrink: true },
        metrics,
        options
      );
      if (!root) continue;
      getFrame(member.baseMap).add(root);
      prototypes.push(root);
    } catch (e) {
      console.error("[createHeadlessBlockPrototypes] member build failed", e);
    }
  }
  const dispose = () => prototypes.forEach(disposeObject);
  if (!prototypes.length) return null;

  const originFrame = getFrame(originBaseMap);
  frames.forEach((frame) => frame.updateMatrixWorld(true));
  const inverse = getBlockInverseMatrix({
    frame: originFrame,
    baseMap: originMetrics,
    originPx: {
      x: origin.x * originMetrics.imageWidth,
      y: origin.y * originMetrics.imageHeight,
    },
    originZ: origin.z,
  });
  if (!inverse) {
    dispose();
    return null;
  }

  /**
   * @param {object} args
   * @param {object} args.instance resolved BLOCK_INSTANCE row (pixel bbox)
   * @param {object} args.baseMap the instance's base map
   */
  function buildInstance({ instance, baseMap }) {
    const metrics = getBaseMapForRender(baseMap);
    if (!instance || !metrics) return null;
    try {
      const root = createAnnotationObject3D(instance, metrics, options);
      if (!root) return null;
      root.add(createBlockContentGroup({ prototypes, inverse }));
      const group = createBaseMapFrameGroup(getBaseMapTransform(baseMap));
      group.add(root);
      group.updateMatrixWorld(true);

      const triangleCount = countSolidTriangles(root);
      if (triangleCount > BRUSH_MAX_HOST_TRIANGLES) {
        return { tooDense: true, triangleCount };
      }
      const data = getHostPartData({
        root,
        group,
        source: instance,
        baseMap,
      });
      if (!data) return null;
      return {
        index: data.getIndex(),
        hash: data.hash,
        matrixWorld: new Matrix4().copy(group.matrixWorld).elements.slice(),
        triangleCount,
      };
    } catch (e) {
      console.error("[createHeadlessBlockPrototypes] instance build failed", e);
      return null;
    }
  }

  return { buildInstance, dispose };
}
