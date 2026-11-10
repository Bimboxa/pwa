import { Mesh } from "three";

import {
  getSoupArea,
  getSoupVolume,
  toNonIndexedArea,
  toNonIndexedVolume,
} from "./getSoupMeasures";
import subtractAnnotationGeometries from "./subtractAnnotationGeometries";

// Below this volume change (m³) a cutter did not touch a closed host.
export const MIN_REMOVED_VOLUME_M3 = 1e-7;
// Same for an OPEN host (a sheet): the carve removes surface, not volume (m²).
export const MIN_REMOVED_AREA_M2 = 1e-6;

// Volume under which a « closed » host is in fact a flat sheet (a POLYGON
// without height): it is measured by its surface instead.
const FLAT_HOST_VOLUME_M3 = 1e-9;

/**
 * The measure of a host solid before any carve, and how to read it.
 *
 * @param {import("three").Mesh} hostSolid one world-space, non-indexed solid
 *   (buildMergedWorldSolid)
 * @param {Object} [options]
 * @param {boolean} [options.hollow] the host is an open surface
 * @returns {{hollow: boolean, measure: number, minRemoved: number}}
 */
export function getHostMeasure(hostSolid, { hollow = false } = {}) {
  let isHollow = Boolean(hollow);
  if (
    !isHollow &&
    Math.abs(getSoupVolume(hostSolid.geometry)) < FLAT_HOST_VOLUME_M3
  ) {
    isHollow = true;
  }
  return {
    hollow: isHollow,
    measure: isHollow
      ? getSoupArea(hostSolid.geometry)
      : Math.abs(getSoupVolume(hostSolid.geometry)),
    minRemoved: isHollow ? MIN_REMOVED_AREA_M2 : MIN_REMOVED_VOLUME_M3,
  };
}

/**
 * What a cutter would remove from a host: m³ for a closed host, m² for an
 * open one. The exact 3D intersection test of « Évider » in 3D — the same
 * boolean as the live carve, run on a throwaway copy of the host (the host
 * solid itself is left untouched).
 *
 * The cutter objects must be attached to their final parent with their world
 * matrices up to date (subtractAnnotationGeometries works in world space).
 *
 * @param {Object} args
 * @param {import("three").Mesh} args.hostSolid
 * @param {Array<import("three").Object3D>} args.cutterObjects
 * @param {{hollow: boolean, measure: number}} args.hostMeasure getHostMeasure
 * @returns {number} the removed measure, 0 when the cutter misses the host
 */
export default function getSubtractionRemovedMeasure({
  hostSolid,
  cutterObjects,
  hostMeasure,
}) {
  if (!hostSolid?.geometry || !cutterObjects?.length) return 0;
  const { hollow, measure } = hostMeasure ?? getHostMeasure(hostSolid);

  const probe = new Mesh(hostSolid.geometry.clone(), hostSolid.material);
  probe.userData = { role: "SOLID" };
  probe.updateMatrixWorld(true);
  try {
    subtractAnnotationGeometries(probe, cutterObjects, { hollow });
    if (!probe.userData?.hasSubtraction) return 0;
    const after = hollow
      ? toNonIndexedArea(probe.geometry)
      : Math.abs(toNonIndexedVolume(probe.geometry));
    return Math.max(0, measure - after);
  } catch (e) {
    console.warn("[getSubtractionRemovedMeasure] failed", e);
    return 0;
  } finally {
    probe.geometry?.dispose?.();
  }
}
