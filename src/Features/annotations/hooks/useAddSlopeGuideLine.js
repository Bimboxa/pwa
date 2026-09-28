import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { setSubSelection } from "Features/selection/selectionSlice";

import { nanoid } from "@reduxjs/toolkit";

import useSelectedAnnotation from "./useSelectedAnnotation";
import useUpdateAnnotation from "./useUpdateAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getPolygonMainAxisPolyline from "Features/geometry/utils/getPolygonMainAxisPolyline";

import db from "App/db/db";

const DEFAULT_SLOPE_PCT = 10;

// "Ajouter une pente": appends a guide line running along the main axis of
// the selected POLYGON (longest median of a rectangle, skeleton-like line
// otherwise — see getPolygonMainAxisPolyline) with a default 10 % slope, then
// sub-selects it so the toolbar switches to the guide line row.
// Same storage as the manual ADD_GUIDE_LINE tool: normalized points in
// db.points, `guideLines: [{ points: [{pointId, type}], slopePct }]`.
export default function useAddSlopeGuideLine() {
  const dispatch = useDispatch();

  const selectedAnnotation = useSelectedAnnotation();
  const baseMap = useMainBaseMap();
  const updateAnnotation = useUpdateAnnotation();

  return async () => {
    if (!selectedAnnotation?.id || selectedAnnotation.type !== "POLYGON")
      return;

    const toastError = (message) =>
      dispatch(setToaster({ message, isError: true }));

    const imageSize = baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) {
      toastError("Ajouter une pente : taille de l'image indisponible");
      return;
    }

    // selectedAnnotation.points / cuts are resolved pixel coordinates.
    const axis = getPolygonMainAxisPolyline(selectedAnnotation.points, {
      cuts: selectedAnnotation.cuts,
    });
    if (!axis || axis.length < 2) {
      toastError("Ajouter une pente : axe principal introuvable");
      return;
    }

    // Read the raw record: its guideLines hold point refs, never the resolved
    // x/y of the React-side annotation.
    const rawAnnotation = await db.annotations.get(selectedAnnotation.id);
    if (!rawAnnotation) return;
    const prevGuideLines = Array.isArray(rawAnnotation.guideLines)
      ? rawAnnotation.guideLines
      : [];

    const pointRows = axis.map((p) => ({
      id: nanoid(),
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      projectId: rawAnnotation.projectId,
      baseMapId: rawAnnotation.baseMapId,
      listingId: rawAnnotation.listingId,
    }));

    // Keep the S-C-S arc control points ("circle") so the guide line renders
    // as arcs, like a hand-drawn guide line.
    const guideLine = {
      points: pointRows.map((row, i) => ({
        pointId: row.id,
        type: axis[i]?.type === "circle" ? "circle" : "square",
      })),
      slopePct: DEFAULT_SLOPE_PCT,
    };

    await updateAnnotation(
      {
        id: selectedAnnotation.id,
        guideLines: [...prevGuideLines, guideLine],
      },
      { pointRowsToSave: pointRows }
    );

    dispatch(
      setSubSelection({
        partId: `${selectedAnnotation.id}::GUIDE_LINE::${prevGuideLines.length}`,
        partType: "GUIDE_LINE",
      })
    );
  };
}
