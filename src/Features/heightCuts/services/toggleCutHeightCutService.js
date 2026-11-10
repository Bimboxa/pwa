import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { HEIGHT_CUT_SIDE_TOP } from "../constants/heightCutConstants";
import { isClosedTrace } from "../utils/computeHeightFaces";

// « Découper » switch of a closed shape drawn in a POLYGON: moves it between
// annotation.cuts (a real hole) and annotation.heightCuts (a face with an
// altitude delta) — same points, the other reading.
//
// - { annotationId, cutPointIds } : the cut whose ring holds these point ids
//   becomes a height cut (delta 0, top side). Its per-segment flags, which
//   only make sense on a hole, are dropped.
// - { annotationId, heightCutId } : the closed height cut becomes a hole.
//
// Returns true when the annotation was updated.
export default async function toggleCutHeightCutService({
  annotationId,
  cutPointIds,
  heightCutId,
}) {
  const raw = await db.annotations.get(annotationId);
  if (!raw) return false;

  if (heightCutId != null) {
    const trace = (raw.heightCuts ?? []).find((t) => t.id === heightCutId);
    if (!trace || !isClosedTrace(trace)) return false;
    const cut = {
      points: (trace.points ?? []).map(({ pointId, type }) =>
        type ? { id: pointId, type } : { id: pointId }
      ),
    };
    if (trace.label) cut.label = trace.label;
    await db.annotations.update(annotationId, {
      cuts: [...(raw.cuts ?? []), cut],
      heightCuts: raw.heightCuts.filter((t) => t.id !== heightCutId),
    });
    return true;
  }

  const ids = new Set(cutPointIds ?? []);
  if (!ids.size) return false;
  const cutIdx = (raw.cuts ?? []).findIndex(
    (cut) =>
      cut?.points?.length === ids.size &&
      cut.points.every((p) => ids.has(p.id))
  );
  if (cutIdx < 0) return false;
  const cut = raw.cuts[cutIdx];
  const heightCut = {
    id: nanoid(),
    points: cut.points.map(({ id, type }) =>
      type ? { pointId: id, type } : { pointId: id }
    ),
    delta: 0,
    side: HEIGHT_CUT_SIDE_TOP,
  };
  if (cut.label) heightCut.label = cut.label;
  await db.annotations.update(annotationId, {
    cuts: raw.cuts.filter((_, i) => i !== cutIdx),
    heightCuts: [...(raw.heightCuts ?? []), heightCut],
  });
  return true;
}
