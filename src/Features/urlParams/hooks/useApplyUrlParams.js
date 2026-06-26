import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { setViewerMode } from "../urlParamsSlice";
import { setSelectedViewerKey } from "Features/viewers/viewersSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

/**
 * Applies URL query params to drive default app behaviors:
 * - viewer=3d        → open the 3D viewer
 * - mode=viewer      → locked "viewer" UI mode (s.urlParams.viewerMode)
 * - baseMapIdx=N     → open the Nth baseMap (1-based) of the selected baseMaps listing,
 *                      deferred until baseMaps are loaded.
 *
 * Params are kept in the URL so a reload re-applies them.
 */
export default function useApplyUrlParams() {
  const dispatch = useDispatch();

  // params

  const [searchParams] = useSearchParams();
  const viewer = searchParams.get("viewer");
  const mode = searchParams.get("mode");
  const baseMapIdx = searchParams.get("baseMapIdx");

  // data

  const selectedBaseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );
  const { value: baseMaps } = useBaseMaps({
    filterByListingId: selectedBaseMapsListingId,
  });

  // guards (apply once)

  const appliedSimpleRef = useRef(false);
  const appliedBaseMapIdxRef = useRef(false);

  // effect - viewer & mode (one-shot, on mount)
  // viewer=3d also relies on LayoutDesktop skipping its "force MAP" reset when the
  // URL requests 3D, so this dispatch is not clobbered on load.

  useEffect(() => {
    if (appliedSimpleRef.current) return;
    appliedSimpleRef.current = true;

    if (viewer === "3d") {
      dispatch(setSelectedViewerKey("THREED"));
    }
    if (mode === "viewer") {
      dispatch(setViewerMode(true));
    }
  }, [viewer, mode]);

  // effect - baseMapIdx (deferred until baseMaps are loaded)

  useEffect(() => {
    if (appliedBaseMapIdxRef.current) return;
    if (!baseMapIdx) return;
    // wait until a baseMaps listing is selected so we index within that listing
    if (!selectedBaseMapsListingId) return;

    const idx = parseInt(baseMapIdx, 10) - 1; // 1-based param
    if (Number.isNaN(idx) || idx < 0) return;
    if (!(baseMaps?.length > 0)) return;

    const target = baseMaps[idx];
    if (!target) return;

    appliedBaseMapIdxRef.current = true;
    dispatch(setSelectedMainBaseMapId(target.id));
    dispatch(setSelectedBaseMapsListingId(target.listingId));
  }, [baseMapIdx, selectedBaseMapsListingId, baseMaps?.length]);
}
