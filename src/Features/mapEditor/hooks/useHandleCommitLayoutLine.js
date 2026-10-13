import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItem,
  setSubSelection,
} from "Features/selection/selectionSlice";

import db from "App/db/db";

import { LAYOUT_LINE_DEFAULTS } from "Features/annotations/utils/computeLayoutLineBars";

// Commits a drawn layoutLine ("ligne de calepinage") onto the currently
// selected POLYGON. The input is a polyline in pixel (resolved) space — same
// units as annotation.points after useAnnotationsV2. Points are normalized to
// [0..1] vs the basemap image size and stored in db.points; the annotation
// references them via
// `layoutLines: [{ points: [{pointId, type}], densityMode, densityValue,
//   densityUnitLabel, layoutAlign, label, renderMode }]`.
//
// The density / alignment of a new line default to the previous line's
// (else LAYOUT_LINE_DEFAULTS). Atomic db.points + db.annotations write.
export default function useHandleCommitLayoutLine() {
  const dispatch = useDispatch();
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

    const prevLayoutLines = Array.isArray(ann.layoutLines)
      ? ann.layoutLines
      : [];
    const prev = prevLayoutLines[prevLayoutLines.length - 1];
    const newLayoutLine = {
      // Straight segments only — type is always "square".
      points: newPoints.map((np) => ({ pointId: np.id, type: "square" })),
      densityMode: prev?.densityMode ?? LAYOUT_LINE_DEFAULTS.densityMode,
      densityValue: prev?.densityValue ?? LAYOUT_LINE_DEFAULTS.densityValue,
      densityUnitLabel:
        prev?.densityUnitLabel ?? LAYOUT_LINE_DEFAULTS.densityUnitLabel,
      layoutAlign: prev?.layoutAlign ?? LAYOUT_LINE_DEFAULTS.layoutAlign,
      label: LAYOUT_LINE_DEFAULTS.label,
      renderMode: prev?.renderMode ?? LAYOUT_LINE_DEFAULTS.renderMode,
      color: prev?.color ?? LAYOUT_LINE_DEFAULTS.color,
      showDensityInLabel:
        prev?.showDensityInLabel ?? LAYOUT_LINE_DEFAULTS.showDensityInLabel,
      coverWholeSurface:
        prev?.coverWholeSurface ?? LAYOUT_LINE_DEFAULTS.coverWholeSurface,
    };

    await db.transaction("rw", db.points, db.annotations, async () => {
      for (const np of newPoints) {
        await db.points.add(np);
      }
      await db.annotations.update(annotationId, {
        layoutLines: [...prevLayoutLines, newLayoutLine],
      });
    });

    // Keep the freshly drawn layout line sub-selected so its properties
    // panel (density / alignment / bars) opens right away.
    dispatch(
      setSubSelection({
        partId: `${annotationId}::LAYOUT_LINE::${prevLayoutLines.length}`,
        partType: "LAYOUT_LINE",
      })
    );
  };
}
