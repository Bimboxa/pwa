import { useEffect } from "react";

import { useSelector } from "react-redux";

import { Plane, Vector3 } from "three";

import db from "App/db/db";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { setHighlightClippingPlanes } from "Features/threedEditor/js/utilsAnnotationsManager/applyAnnotationMaterialState";
import { setFaceHoverClippingPlanes } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { getLocalScanViews } from "Features/localScans/services/localScanViewRegistry";

import getBaseMapClipSlabPlanes from "../utils/getBaseMapClipSlabPlanes";

// Mirrors the base maps used as clipping planes
// (threedEditor.clippingBaseMapIdsIn3d) to the 3D scene: the slab planes of
// each of them (depths stored on the record, baseMap.clipping3d) go to
// ClippingManager.setBaseMapClips, which cuts the annotations and the point
// clouds.
//
// Same data flow as useApplyBaseMapTransformsIn3d: the fresh records are
// read from db.baseMaps whenever the `baseMapsUpdatedAt` counter moves, so a
// base map moved / rotated in 3D, or a depth edited in the panel, re-cuts
// the scene live. Mounted once from MainThreedEditor.
export default function useApplyBaseMapClippingIn3d({ rendererIsReady }) {
  const clippingBaseMapIds = useSelector(
    (s) => s.threedEditor.clippingBaseMapIdsIn3d
  );
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);

  useEffect(() => {
    if (!rendererIsReady) return;
    const sceneManager = getActiveThreedEditor()?.sceneManager;
    const clippingManager = sceneManager?.clippingManager;
    if (!clippingManager?.setBaseMapClips) return;

    // The highlight materials are swapped in place of the (clipped)
    // annotation materials: keep them cut the same way.
    function syncHighlights() {
      const planes = clippingManager.getAnnotationClipPlanes();
      setHighlightClippingPlanes(planes);
      setFaceHoverClippingPlanes(planes);
    }

    if (!clippingBaseMapIds?.length) {
      clippingManager.setBaseMapClips(null);
      syncHighlights();
      return;
    }

    let cancelled = false;
    (async () => {
      const records = await db.baseMaps.bulkGet(clippingBaseMapIds);
      if (cancelled) return;
      const planes = records
        // the cut only exists while the feature is enabled on the base map
        .filter((record) => record?.clipping3d?.enabled)
        .flatMap((record) => getBaseMapClipSlabPlanes(record))
        .map(
          ({ normal, constant }) =>
            new Plane(new Vector3(normal.x, normal.y, normal.z), constant)
        );
      clippingManager.setBaseMapClips({
        planes,
        // the Scan 3D tool's own cloud lives outside the base map groups
        getExtraRoots: () =>
          getLocalScanViews()
            .filter((view) => view.root?.parent === sceneManager.scene)
            .map((view) => view.root),
      });
      syncHighlights();
    })();

    return () => {
      cancelled = true;
    };
  }, [rendererIsReady, clippingBaseMapIds, baseMapsUpdatedAt]);

  // Editor teardown / 2D: nothing stays cut.
  useEffect(() => {
    if (!rendererIsReady) return;
    const clippingManager =
      getActiveThreedEditor()?.sceneManager?.clippingManager;
    return () => clippingManager?.setBaseMapClips?.(null);
  }, [rendererIsReady]);
}
