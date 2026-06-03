import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import db from "App/db/db";

// Commits a drawn guideLine onto the currently selected annotation. The input
// is a polyline in pixel (resolved) space — same units as annotation.points
// after useAnnotationsV2. Points are normalized to [0..1] vs the basemap
// image size and stored in db.points; the annotation references them via
// `guideLines: [{ points: [{pointId, type}], slopePct }]`.
//
// Each draw APPENDS a new guideLine to the ordered sequence (drawing order =
// ramp order; the first line is the low point). The new line's slope defaults
// to the previous line's slope (else 0). Atomic db.points + db.annotations write.
export default function useHandleCommitGuideLine() {
  const selectedItem = useSelector(selectSelectedItem);

  return async (pixelPts) => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    if (!annotationId || !Array.isArray(pixelPts) || pixelPts.length < 2) {
      return;
    }

    const ann = await db.annotations.get(annotationId);
    if (!ann) return;
    const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
    const imageSize = baseMapRecord?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) return;

    const newPoints = pixelPts.map((p) => ({
      id: nanoid(),
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      projectId: ann.projectId,
      baseMapId: ann.baseMapId,
      listingId: ann.listingId,
    }));

    const prevGuideLines = Array.isArray(ann.guideLines) ? ann.guideLines : [];
    const defaultSlopePct = prevGuideLines.length
      ? prevGuideLines[prevGuideLines.length - 1]?.slopePct ?? 0
      : 0;
    const newGuideLine = {
      points: newPoints.map((np, i) => ({
        pointId: np.id,
        // Preserve the per-point type toggled during drawing (square <-> circle)
        // so square->circle->square triplets render as arcs.
        type: pixelPts[i]?.type === "circle" ? "circle" : "square",
      })),
      slopePct: defaultSlopePct,
    };

    await db.transaction("rw", db.points, db.annotations, async () => {
      for (const np of newPoints) {
        await db.points.add(np);
      }
      await db.annotations.update(annotationId, {
        guideLines: [...prevGuideLines, newGuideLine],
      });
    });
  };
}
