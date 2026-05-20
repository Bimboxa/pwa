import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import db from "App/db/db";

// Commits a drawn guideLine onto the currently selected annotation. The input
// is a polyline in pixel (resolved) space — same units as annotation.points
// after useAnnotationsV2. Points are normalized to [0..1] vs the basemap
// image size and stored in db.points; the annotation references them via
// `guideLine: [{ pointId, type }]`. Redrawing REPLACES the previous guideLine
// (one guideLine per annotation). Atomic db.points + db.annotations write.
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

    await db.transaction("rw", db.points, db.annotations, async () => {
      for (const np of newPoints) {
        await db.points.add(np);
      }
      await db.annotations.update(annotationId, {
        guideLine: newPoints.map((np) => ({ pointId: np.id, type: "square" })),
      });
    });
  };
}
