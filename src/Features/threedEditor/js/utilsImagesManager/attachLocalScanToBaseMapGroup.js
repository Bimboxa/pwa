import { Group, Matrix4 } from "three";

import db from "App/db/db";
import localScanRuntime from "Features/localScans/services/localScanRuntime";
import createLocalScanView from "Features/localScans/services/createLocalScanView";

const noRaycast = () => false;

// Identity of the point cloud attached to a base map group: the resource
// and the stored pose. The display mode is applied in place (setMode).
export function getLocalScanGroupKey(baseMap) {
  const localScan = baseMap?.localScan;
  if (!localScan?.resourceId || localScan.matrix?.length !== 16) return null;
  return `${localScan.resourceId}|${localScan.matrix.join(",")}`;
}

// Point cloud of a base map projected from a local scan (Scan 3D tool),
// attached to the base map group so it follows the base map pose — 2D
// recalage, « Déplacer » / « Tourner » in 3D, gizmo, altitude.
//
//   localScanWrap (sibling of meshWrap: no drawing offset, no meterByPx;
//     pose = baseMap.localScan.matrix, the scan root in the group frame at
//     creation) → scan root (source units, untransformed) → points / splats
//
// The decoded points come from the shared localScanRuntime (one decode per
// resource and load zone, shared with the Scan 3D tool). Missing file on this
// device → nothing attached (the properties panel says so).
//
// options: {sceneManager, mode: "POINTS" | "SPLAT", onLoaded}. Returns
// {dispose, setMode}.
export default function attachLocalScanToBaseMapGroup(group, baseMap, options) {
  const { resourceId, matrix } = baseMap.localScan;
  const { sceneManager } = options;

  const wrap = new Group();
  wrap.userData.kind = "baseMapLocalScanWrap";
  wrap.userData.isDecor = true;
  wrap.raycast = noRaycast;
  new Matrix4()
    .fromArray(matrix)
    .decompose(wrap.position, wrap.quaternion, wrap.scale);
  group.add(wrap);
  group.userData.localScanWrap = wrap;

  let disposed = false,
    handle = null,
    view = null,
    source = null,
    kind = null,
    mode = options.mode;

  function applyMode() {
    if (!view) return;
    // « Réaliste » needs Gaussian data: a plain point cloud stays in points.
    const next = mode === "SPLAT" && kind === "SPLAT" ? "SPLAT" : "POINTS";
    view.setMode(next, source).then(options.onLoaded, (error) => {
      console.warn("[localScan] realistic display unavailable", error);
    });
  }

  (async () => {
    const resource = await db.resources.get(resourceId);
    if (disposed) return;
    if (!resource || resource.deletedAt) return;
    handle = localScanRuntime.acquire(resource);
    const loaded = await handle.promise;
    if (disposed) return;
    source = loaded.source;
    kind = loaded.data.kind;
    view = createLocalScanView(
      { sceneManager, requestRender: sceneManager.requestRender },
      loaded.data,
      { parent: wrap }
    );
    view.setPointSize(resource.scan?.display?.pointSize ?? 2);
    applyMode();
    options.onLoaded?.();
  })().catch((error) => {
    if (!disposed) console.warn("[localScan] scan base map not loaded", error);
  });

  return {
    setMode(next) {
      if (next === mode) return;
      mode = next;
      applyMode();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      view?.dispose();
      handle?.release();
      group.remove(wrap);
      if (group.userData.localScanWrap === wrap)
        delete group.userData.localScanWrap;
    },
  };
}
