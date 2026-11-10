import { Box3 } from "three";

import isHollowSubtractionHost from "Features/annotations/utils/isHollowSubtractionHost";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

import buildAnnotationSolidObjectsAsync from "./buildAnnotationSolidObjectsAsync";
import buildMergedWorldSolid from "./buildMergedWorldSolid";
import createAnnotationObject3D from "./createAnnotationObject3D";
import createBaseMapFrameGroup from "./createBaseMapFrameGroup";
import getBaseMapForRender from "./getBaseMapForRender";
import getSubtractionRemovedMeasure, {
  getHostMeasure,
} from "./getSubtractionRemovedMeasure";

// Yield to the browser every N exact tests so the dialog spinner keeps
// turning on a crowded scene.
const YIELD_EVERY = 8;

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

function disposeTree(object) {
  object?.traverse?.((child) => {
    try {
      child.userData?.dispose?.();
    } catch {
      /* ignore */
    }
    if (child.geometry) child.geometry.dispose();
  });
}

/**
 * The annotations whose 3D solid really cuts into the host's — the candidates
 * of « Évider » in the 3D editor.
 *
 * Headless, same recipe as the permanent bake
 * (bakeAnnotationSubtractionsService): the host is built without any
 * render-only tweak in its base map frame, each candidate in ITS OWN base map
 * frame (cross-baseMap), and a candidate is kept when subtracting it removes
 * something from the host (volume, or surface for an open host). A bounding
 * box test discards the far ones before the boolean.
 *
 * @param {Object} args
 * @param {Object} args.host RESOLVED annotation (pixel points, template
 *   fields applied)
 * @param {Array<Object>} args.candidates RESOLVED annotations to test
 * @param {Object|Map} args.baseMapsById base map records / instances by id
 * @param {Object} [args.buildOptions] AnnotationsManager.getBuildOptions()
 * @param {Function} [args.isCancelled] polled between candidates
 * @returns {Promise<Array<{annotation: Object, removed: number}>>}
 */
export default async function getIntersectingAnnotationsAsync({
  host,
  candidates,
  baseMapsById,
  buildOptions,
  isCancelled,
}) {
  if (!host?.id || !candidates?.length) return [];

  const getBaseMap = (id) =>
    baseMapsById instanceof Map ? baseMapsById.get(id) : baseMapsById?.[id];
  const hostBaseMap = getBaseMap(host.baseMapId);
  const hostMetrics = getBaseMapForRender(hostBaseMap);
  if (!hostMetrics) return [];

  // No render-only tweak (footprint shrink), nor the camera-driven half-view
  // of a revolution.
  const options = { ...(buildOptions ?? {}), antiAliasingShrink: false };
  const hostOptions = {
    ...options,
    revolutionSection: undefined,
    revolutionSectionByAxisId: undefined,
    revolutionSectionFill: false,
  };

  const frames = [];
  let hostSolid = null;
  const results = [];
  try {
    const hostObject = createAnnotationObject3D(
      { ...host, _noAntiAliasingShrink: true },
      hostMetrics,
      hostOptions
    );
    if (!hostObject) return [];
    const hostFrame = createBaseMapFrameGroup(getBaseMapTransform(hostBaseMap));
    hostFrame.add(hostObject);
    frames.push(hostFrame);
    hostFrame.updateMatrixWorld(true);

    hostSolid = buildMergedWorldSolid(hostObject);
    if (!hostSolid) return [];
    const hostMeasure = getHostMeasure(hostSolid, {
      hollow: isHollowSubtractionHost(host),
    });
    if (!(hostMeasure.measure > 0)) return [];
    hostSolid.geometry.computeBoundingBox();
    const hostBox = hostSolid.geometry.boundingBox;

    let tested = 0;
    for (const candidate of candidates) {
      if (isCancelled?.()) return [];
      const baseMap = getBaseMap(candidate.baseMapId);
      const forRender =
        candidate._baseMapForRender ?? getBaseMapForRender(baseMap);
      const transform =
        candidate._baseMapTransform ??
        (baseMap ? getBaseMapTransform(baseMap) : null);
      if (!forRender || !transform) continue;

      let frame = null;
      try {
        const objects = (
          await buildAnnotationSolidObjectsAsync(
            { ...candidate, _noAntiAliasingShrink: true },
            forRender,
            options
          )
        ).filter(Boolean);
        if (objects.length === 0) continue;
        frame = createBaseMapFrameGroup(transform);
        objects.forEach((object) => frame.add(object));
        frame.updateMatrixWorld(true);

        const box = new Box3().setFromObject(frame);
        if (box.isEmpty() || !hostBox.intersectsBox(box)) continue;

        const removed = getSubtractionRemovedMeasure({
          hostSolid,
          cutterObjects: objects,
          hostMeasure,
        });
        if (removed >= hostMeasure.minRemoved) {
          results.push({ annotation: candidate, removed });
        }
        tested += 1;
        if (tested % YIELD_EVERY === 0) await yieldToBrowser();
      } catch (e) {
        console.warn(
          `[getIntersectingAnnotationsAsync] ${candidate.id} skipped`,
          e
        );
      } finally {
        disposeTree(frame);
      }
    }
    return results;
  } finally {
    frames.forEach(disposeTree);
    hostSolid?.geometry?.dispose?.();
  }
}
