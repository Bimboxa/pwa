import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { setSubSelection } from "Features/selection/selectionSlice";

import { nanoid } from "@reduxjs/toolkit";

import useSelectedAnnotation from "./useSelectedAnnotation";
import useAnnotationsV2 from "./useAnnotationsV2";
import useUpdateAnnotation from "./useUpdateAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import findAdjacentPolygonEdges from "../utils/findAdjacentPolygonEdges";
import computeAutoSlopeFromNeighbors from "../utils/computeAutoSlopeFromNeighbors";

import db from "App/db/db";

// "Pente auto": slopes the selected POLYGON so its surface connects the top
// edges of its two adjacent polygons. Writes a single guide line between the
// shared-edge midpoints (low -> high) with the computed slopePct, replacing
// any existing guideLines, and aligns offsetZ on the low neighbor's top.
// Per-vertex offsetTop is NOT written — it is derived at resolve time by
// applyGuideLineRampToRings.
export default function useApplyAutoSlope() {
  const dispatch = useDispatch();

  const selectedAnnotation = useSelectedAnnotation();
  const annotations = useAnnotationsV2({
    filterByMainBaseMap: true,
    caller: "useApplyAutoSlope",
  });
  const baseMap = useMainBaseMap();
  const updateAnnotation = useUpdateAnnotation();

  return async () => {
    if (!selectedAnnotation?.id || selectedAnnotation.type !== "POLYGON")
      return;

    const toastError = (message) =>
      dispatch(setToaster({ message, isError: true }));

    const imageSize = baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) {
      toastError("Pente auto : taille de l'image indisponible");
      return;
    }

    const meterByPx = baseMap?.getMeterByPx?.();
    if (!meterByPx || meterByPx <= 0) {
      toastError("Pente auto : échelle du plan non définie");
      return;
    }

    const candidates = (annotations ?? []).filter(
      (a) =>
        a.type === "POLYGON" &&
        a.baseMapId === selectedAnnotation.baseMapId &&
        a.id !== selectedAnnotation.id
    );

    const neighborEdges = findAdjacentPolygonEdges({
      selectedAnnotation,
      candidates,
      meterByPx,
    });
    if (neighborEdges.length !== 2) {
      toastError(
        `Pente auto : il faut exactement 2 polygones adjacents (${neighborEdges.length} trouvé${neighborEdges.length > 1 ? "s" : ""})`
      );
      return;
    }

    const result = computeAutoSlopeFromNeighbors({ neighborEdges, meterByPx });
    if (!result.ok) {
      toastError("Pente auto : arêtes partagées trop proches");
      return;
    }

    const rawAnnotation = await db.annotations.get(selectedAnnotation.id);
    if (!rawAnnotation) return;

    const pointRows = [result.mLow, result.mHigh].map((p) => ({
      id: nanoid(),
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      projectId: rawAnnotation.projectId,
      baseMapId: rawAnnotation.baseMapId,
      listingId: rawAnnotation.listingId,
    }));

    const guideLine = {
      points: [
        { pointId: pointRows[0].id, type: "square" },
        { pointId: pointRows[1].id, type: "square" },
      ],
      slopePct: result.slopePct,
    };

    await updateAnnotation(
      {
        id: selectedAnnotation.id,
        guideLines: [guideLine],
        offsetZ: result.offsetZ,
      },
      { pointRowsToSave: pointRows }
    );

    // Sub-select the new guideLine so the toolbar switches to the slope row.
    dispatch(
      setSubSelection({
        partId: `${selectedAnnotation.id}::GUIDE_LINE::0`,
        partType: "GUIDE_LINE",
      })
    );
  };
}
