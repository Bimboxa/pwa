import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItem,
  setSubSelection,
} from "Features/selection/selectionSlice";

import db from "App/db/db";

import {
  getAnnotationContourRingsPx,
  projectPointOnContourRings,
} from "Features/annotations/utils/getAnnotationContourRingsPx";

// Endpoints further than this (image px) from every contour ring keep their
// drawn position — the 3D partition then falls back to the interpolated
// height field instead of the exact planar strips.
const CONTOUR_SNAP_TOL_PX = 20;

// Commits a drawn isoHeightLine (contour line: every point of the line sits at
// the same height) onto the currently selected POLYGON. The input is a
// polyline in pixel (resolved) space — same units as annotation.points after
// useAnnotationsV2. Points are normalized to [0..1] vs the basemap image size
// and stored in db.points; the annotation references them via
// `isoHeightLines: [{ points: [{pointId, type}], height }]` (height in meters,
// offsetTop semantics — one value for the whole line).
//
// The FIRST and LAST drawn points are projected onto the nearest contour ring
// (main or cuts) when close enough: the exact 3D strip partition needs the
// line's endpoints ON the contour, and drawing precisely on an edge is hard.
export default function useHandleCommitIsoHeightLine() {
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

    const rings = await getAnnotationContourRingsPx(ann, imageSize);

    const snappedPts = pixelPts.map((p, i) =>
      i === 0 || i === pixelPts.length - 1
        ? { ...p, ...projectPointOnContourRings(p, rings, CONTOUR_SNAP_TOL_PX) }
        : p
    );

    const newPoints = snappedPts.map((p) => ({
      id: nanoid(),
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      projectId: ann.projectId,
      baseMapId: ann.baseMapId,
      listingId: ann.listingId,
    }));

    const prevIsoLines = Array.isArray(ann.isoHeightLines)
      ? ann.isoHeightLines
      : [];
    const defaultHeight = prevIsoLines.length
      ? prevIsoLines[prevIsoLines.length - 1]?.height ?? 0
      : 0;
    const newIsoLine = {
      // V1: iso lines carry straight segments only (no arcs) so the 3D quad
      // partition stays tractable — type is always "square".
      points: newPoints.map((np) => ({ pointId: np.id, type: "square" })),
      height: defaultHeight,
    };

    await db.transaction("rw", db.points, db.annotations, async () => {
      for (const np of newPoints) {
        await db.points.add(np);
      }
      await db.annotations.update(annotationId, {
        isoHeightLines: [...prevIsoLines, newIsoLine],
      });
    });

    // Keep the freshly drawn iso line sub-selected so the annotation toolbar
    // switches to the iso-line edit row (height / delete).
    dispatch(
      setSubSelection({
        partId: `${annotationId}::ISO_HEIGHT_LINE::${prevIsoLines.length}`,
        partType: "ISO_HEIGHT_LINE",
      })
    );
  };
}
