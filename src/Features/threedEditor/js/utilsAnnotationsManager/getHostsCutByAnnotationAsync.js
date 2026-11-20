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

// Yield to the browser every N exact tests: the detection runs in the
// background of an edit, the UI must stay responsive.
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
 * The hosts a cutter annotation really cuts into — the mirror of
 * getIntersectingAnnotationsAsync (one host, N cutters), used by « soustraire
 * au contact » (one cutter, N candidate hosts).
 *
 * Headless, same recipe: the cutter solid is built ONCE in its own base map
 * frame (as a closed operand: a « Fosse » carves as its closed prism), each
 * host without any render-only tweak in ITS OWN base map frame
 * (cross-baseMap), and a host is kept when subtracting the cutter removes
 * something from it (volume, or surface for an open host — so a cutter lying
 * ON a sheet cuts it, while a closed solid it merely touches is left alone).
 * A bounding box test discards the far hosts before the boolean.
 *
 * @param {Object} args
 * @param {Object} args.cutter RESOLVED annotation (pixel points, template
 *   fields applied)
 * @param {Array<Object>} args.hosts RESOLVED annotations to test
 * @param {Object|Map} args.baseMapsById base map records / instances by id
 * @param {Object} [args.buildOptions] AnnotationsManager.getBuildOptions()
 * @param {Function} [args.isCancelled] polled between hosts
 * @returns {Promise<Array<{annotation: Object, removed: number}>>}
 */
export default async function getHostsCutByAnnotationAsync({
  cutter,
  hosts,
  baseMapsById,
  buildOptions,
  isCancelled,
}) {
  if (!cutter?.id || !hosts?.length) return [];

  const getBaseMap = (id) =>
    baseMapsById instanceof Map ? baseMapsById.get(id) : baseMapsById?.[id];
  const cutterBaseMap = getBaseMap(cutter.baseMapId);
  const cutterMetrics = getBaseMapForRender(cutterBaseMap);
  if (!cutterMetrics) return [];

  // No render-only tweak (footprint shrink), nor the camera-driven half-view
  // of a revolution.
  const options = { ...(buildOptions ?? {}), antiAliasingShrink: false };
  const hostOptions = {
    ...options,
    revolutionSection: undefined,
    revolutionSectionByAxisId: undefined,
    revolutionSectionFill: false,
  };

  let cutterFrame = null;
  const results = [];
  try {
    const cutterObjects = (
      await buildAnnotationSolidObjectsAsync(
        { ...cutter, _noAntiAliasingShrink: true },
        cutterMetrics,
        options
      )
    ).filter(Boolean);
    if (cutterObjects.length === 0) return [];
    cutterFrame = createBaseMapFrameGroup(getBaseMapTransform(cutterBaseMap));
    cutterObjects.forEach((object) => cutterFrame.add(object));
    cutterFrame.updateMatrixWorld(true);
    const cutterBox = new Box3().setFromObject(cutterFrame);
    if (cutterBox.isEmpty()) return [];

    let tested = 0;
    for (const host of hosts) {
      if (isCancelled?.()) return [];
      const baseMap = getBaseMap(host.baseMapId);
      const hostMetrics = getBaseMapForRender(baseMap);
      if (!hostMetrics) continue;

      let hostFrame = null;
      let hostSolid = null;
      try {
        const hostObject = createAnnotationObject3D(
          { ...host, _noAntiAliasingShrink: true },
          hostMetrics,
          hostOptions
        );
        if (!hostObject) continue;
        hostFrame = createBaseMapFrameGroup(getBaseMapTransform(baseMap));
        hostFrame.add(hostObject);
        hostFrame.updateMatrixWorld(true);

        const hostBox = new Box3().setFromObject(hostFrame);
        if (hostBox.isEmpty() || !hostBox.intersectsBox(cutterBox)) continue;

        hostSolid = buildMergedWorldSolid(hostObject);
        if (!hostSolid) continue;
        const hostMeasure = getHostMeasure(hostSolid, {
          hollow: isHollowSubtractionHost(host),
        });
        if (!(hostMeasure.measure > 0)) continue;

        const removed = getSubtractionRemovedMeasure({
          hostSolid,
          cutterObjects,
          hostMeasure,
        });
        if (removed >= hostMeasure.minRemoved) {
          results.push({ annotation: host, removed });
        }
        tested += 1;
        if (tested % YIELD_EVERY === 0) await yieldToBrowser();
      } catch (e) {
        console.warn(`[getHostsCutByAnnotationAsync] ${host.id} skipped`, e);
      } finally {
        disposeTree(hostFrame);
        hostSolid?.geometry?.dispose?.();
      }
    }
    return results;
  } finally {
    disposeTree(cutterFrame);
  }
}
