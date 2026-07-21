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
import { getContourHeightAt } from "Features/annotations/utils/applyProfileEndpointContinuity";

// Endpoints further than this (image px) from every contour ring keep their
// drawn position — the shell build then treats the drawn spot as the anchor.
const CONTOUR_SNAP_TOL_PX = 20;

// Commits a drawn profileLine (shell cross-section) onto the currently
// selected POLYGON. The input is a polyline in pixel (resolved) space — same
// units as annotation.points after useAnnotationsV2. Points are normalized to
// [0..1] vs the basemap image size and stored in db.points; the annotation
// references them via `profileLines: [{ points: [{pointId, type, height?}] }]`
// (height in meters, offsetTop semantics, INLINE on interior refs only —
// endpoint heights are derived from the contour at resolve time).
//
// The FIRST and LAST drawn points are projected onto the nearest contour ring
// (main or cuts) when close enough. Default interior heights interpolate
// linearly (by curvilinear distance) between the two endpoint contour heights
// so the freshly drawn profile starts continuous with the surface.
export default function useHandleCommitProfileLine() {
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

    // Default interior heights: lerp between the endpoint contour heights by
    // cumulative distance along the drawn polyline.
    const h0 = getContourHeightAt(snappedPts[0], rings);
    const h1 = getContourHeightAt(snappedPts[snappedPts.length - 1], rings);
    const cum = [0];
    for (let i = 1; i < snappedPts.length; i += 1) {
      cum.push(
        cum[i - 1] +
          Math.hypot(
            snappedPts[i].x - snappedPts[i - 1].x,
            snappedPts[i].y - snappedPts[i - 1].y
          )
      );
    }
    const total = cum[cum.length - 1] || 1;

    const newPoints = snappedPts.map((p) => ({
      id: nanoid(),
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      projectId: ann.projectId,
      baseMapId: ann.baseMapId,
      listingId: ann.listingId,
    }));

    const prevProfileLines = Array.isArray(ann.profileLines)
      ? ann.profileLines
      : [];
    const last = newPoints.length - 1;
    const newProfileLine = {
      // V1: profile lines carry straight segments only (no arcs) — type is
      // always "square". Endpoints store NO height (derived from the contour
      // at resolve time — continuity).
      points: newPoints.map((np, i) => ({
        pointId: np.id,
        type: "square",
        ...(i === 0 || i === last
          ? {}
          : { height: h0 + (h1 - h0) * (cum[i] / total) }),
      })),
    };

    await db.transaction("rw", db.points, db.annotations, async () => {
      for (const np of newPoints) {
        await db.points.add(np);
      }
      await db.annotations.update(annotationId, {
        profileLines: [...prevProfileLines, newProfileLine],
      });
    });

    // Keep the freshly drawn profile sub-selected so the annotation toolbar
    // switches to the profile edit row and the Élévation panel targets it.
    dispatch(
      setSubSelection({
        partId: `${annotationId}::PROFILE_LINE::${prevProfileLines.length}`,
        partType: "PROFILE_LINE",
      })
    );
  };
}
