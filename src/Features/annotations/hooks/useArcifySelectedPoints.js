import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

import getContiguousPointRun from "../utils/getContiguousPointRun";
import fitCircleArcThroughPoints from "Features/geometry/utils/fitCircleArcThroughPoints";
import remapSegmentIdxAfterInsert from "Features/mapEditor/utils/remapSegmentIdxAfterInsert";

// Segment-indexed annotation fields that must be remapped when the ring's
// point refs change (same list as useHandleSplitPolylineClick).
const SEGMENT_IDX_FIELDS = [
  "hiddenSegmentsIdx",
  "isoHeightSegmentsIdx",
  "isExtEdgeSegmentsIdx",
];

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Full-circle square → circle → square ring (3 sub-arcs of 120° each, no
// closing square — the ring closes implicitly on closed shapes).
function buildFullCircleChain(center, r, startAngle) {
  const nSub = 3;
  const dTheta = (Math.PI * 2) / nSub;
  const onCircle = (theta, type) => ({
    x: center.x + r * Math.cos(theta),
    y: center.y + r * Math.sin(theta),
    type,
  });
  const pts = [];
  for (let k = 0; k < nSub; k++) {
    const t0 = startAngle + k * dTheta;
    pts.push(onCircle(t0, "square"));
    pts.push(onCircle(t0 + dTheta / 2, "circle"));
  }
  return pts;
}

function isPointReferenced(annotation, pointId) {
  if (annotation.points?.some((p) => p?.id === pointId)) return true;
  if (annotation.cuts?.some((c) => c?.points?.some((p) => p?.id === pointId))) {
    return true;
  }
  if (annotation.innerPoints?.some((p) => p?.id === pointId)) return true;
  if (
    annotation.guideLines?.some((g) =>
      g?.points?.some((p) => p?.id === pointId || p?.pointId === pointId)
    )
  ) {
    return true;
  }
  return false;
}

// In-place "arc-ify" of a contiguous run of selected points: fits ONE circle
// (least squares) through the selected points and replaces them with a
// square → circle → square arc chain, keeping the rest of the ring untouched.
// Works on the main ring and cut rings of POLYLINE / POLYGON annotations.
export default function useArcifySelectedPoints() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ annotation, pointIds }) => {
    if (!["POLYLINE", "POLYGON"].includes(annotation?.type)) {
      return { changed: false };
    }

    // Run detection on the resolved annotation (pixel-space refs).
    const run = getContiguousPointRun(annotation, pointIds);
    if (!run.valid) return { changed: false };

    const pxRun = run.runRefs.filter(
      (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
    );
    if (pxRun.length < 3) return { changed: false };

    const fit = fitCircleArcThroughPoints(pxRun);
    if (!fit?.chainPoints?.length) {
      console.warn("[arcifyPoints] could not fit a circle (collinear points?)");
      return { changed: false };
    }

    let chain;
    if (run.coversRing) {
      // Whole closed ring selected → replace it with a full circle. Start the
      // chain at the original first point's angle to keep the seam nearby.
      const startAngle = Math.atan2(
        pxRun[0].y - fit.center.y,
        pxRun[0].x - fit.center.x
      );
      chain = buildFullCircleChain(fit.center, fit.r, startAngle);
    } else {
      // fitCircleArcThroughPoints orders the chain CCW from the largest
      // angular gap — flip it if it runs against the ring direction.
      chain = fit.chainPoints;
      const first = pxRun[0];
      if (dist2(chain[0], first) > dist2(chain[chain.length - 1], first)) {
        chain = [...chain].reverse();
      }
    }

    // Image size — convert pixel coords back to normalized [0..1] before
    // storage (match useAnnotationsV2: method first, then prop).
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    const width = imageSize?.width || 1;
    const height = imageSize?.height || 1;

    // Mint fresh point ids; persist normalized [0..1] coords in db.points.
    // Arc identity (type: "circle") only lives on the annotation refs.
    const records = [];
    const chainRefs = chain.map((p) => {
      const id = nanoid();
      records.push({
        id,
        x: p.x / width,
        y: p.y / height,
        projectId: annotation.projectId ?? projectId,
        baseMapId: annotation.baseMapId,
        listingId: annotation.listingId,
      });
      return { id, type: p.type };
    });

    // Splice into the RAW ring (ratio-space refs, same ids / order as the
    // resolved ring).
    const rawAnnotation = await db.annotations.get(annotation.id);
    if (!rawAnnotation) return { changed: false };
    const rawRun = getContiguousPointRun(rawAnnotation, pointIds);
    if (!rawRun.valid || rawRun.ringKey !== run.ringKey) {
      console.warn("[arcifyPoints] raw annotation out of sync with selection");
      return { changed: false };
    }

    const cutIdx =
      rawRun.ringKey === "MAIN" ? null : Number(rawRun.ringKey.split("::")[1]);
    const oldRing =
      cutIdx === null
        ? rawAnnotation.points || []
        : rawAnnotation.cuts?.[cutIdx]?.points || [];

    let newRing;
    if (rawRun.coversRing) {
      newRing = chainRefs;
    } else if (rawRun.wraps) {
      // Rotate the closed ring so the run becomes a head slice, then splice.
      const startIdx = rawRun.indices[0];
      const rotated = [
        ...oldRing.slice(startIdx),
        ...oldRing.slice(0, startIdx),
      ];
      newRing = [...chainRefs, ...rotated.slice(rawRun.indices.length)];
    } else {
      const startIdx = rawRun.indices[0];
      const endIdx = rawRun.indices[rawRun.indices.length - 1];
      newRing = [
        ...oldRing.slice(0, startIdx),
        ...chainRefs,
        ...oldRing.slice(endIdx + 1),
      ];
    }

    // Remap segment-indexed fields (ref-identity based, so the ring rotation
    // above is transparent; segments inside the replaced run are dropped).
    const updates = {};
    if (cutIdx === null) {
      updates.points = newRing;
      SEGMENT_IDX_FIELDS.forEach((field) => {
        if (rawAnnotation[field]?.length) {
          updates[field] = remapSegmentIdxAfterInsert(
            oldRing,
            newRing,
            rawAnnotation[field],
            { closed: rawRun.isClosed }
          );
        }
      });
    } else {
      updates.cuts = rawAnnotation.cuts.map((cut, i) => {
        if (i !== cutIdx) return cut;
        const newCut = { ...cut, points: newRing };
        SEGMENT_IDX_FIELDS.forEach((field) => {
          if (cut[field]?.length) {
            newCut[field] = remapSegmentIdxAfterInsert(
              oldRing,
              newRing,
              cut[field],
              { closed: true }
            );
          }
        });
        return newCut;
      });
    }

    // Replaced refs whose points are no longer referenced anywhere → orphans.
    const replacedIds = rawRun.runRefs.map((p) => p.id).filter(Boolean);
    const allAnnotations = await db.annotations.toArray();
    const updatedSelf = { ...rawAnnotation, ...updates };
    const orphanIds = replacedIds.filter(
      (id) =>
        !allAnnotations.some((a) =>
          a.id === annotation.id
            ? isPointReferenced(updatedSelf, id)
            : isPointReferenced(a, id)
        )
    );

    await db.transaction("rw", db.annotations, db.points, async () => {
      await db.points.bulkAdd(records);
      await db.annotations.update(annotation.id, updates);
      if (orphanIds.length > 0) {
        await db.points.bulkDelete(orphanIds);
      }
    });

    dispatch(triggerAnnotationsUpdate());

    return { changed: true, count: chainRefs.length };
  };
}
