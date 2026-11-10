import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import {
  HEIGHT_CUT_SIDE_BOTTOM,
  HEIGHT_CUT_SIDE_TOP,
} from "../constants/heightCutConstants";

// Sets the altitude delta / side of ONE height face of a POLYGON.
//
// face: an entry of the resolved annotation.heightFaces (pixels) ;
// faces: all of them ; patch: { delta?, side? } ; imageSize: { width, height }.
//
// Where the values are stored:
// - the face already has a seed entry (heightCutFaces) → on that entry ;
// - the face is the whole inside of a closed trace → on the trace ;
// - otherwise (a face delimited by open traces, or one part of a closed
//   trace split by a line) → a new seed entry: a point inside the face
//   (db.points) + the values. The seed follows the annotation like any of
//   its points.
//
// Returns the key of the face after the update (a new seed entry renames it:
// the caller re-selects it), undefined when nothing was written.
export default async function updateHeightFaceService({
  annotationId,
  face,
  faces,
  patch,
  imageSize,
}) {
  const raw = await db.annotations.get(annotationId);
  if (!raw || !face) return;

  const values = {};
  if (patch?.delta !== undefined) {
    const delta = Number(patch.delta);
    values.delta = Number.isFinite(delta) ? delta : 0;
  }
  if (patch?.side !== undefined) {
    values.side =
      patch.side === HEIGHT_CUT_SIDE_BOTTOM
        ? HEIGHT_CUT_SIDE_BOTTOM
        : HEIGHT_CUT_SIDE_TOP;
  }
  if (!Object.keys(values).length) return;

  // 1. Existing seed entry.
  if (face.faceEntryId) {
    const heightCutFaces = (raw.heightCutFaces ?? []).map((entry) =>
      entry.id === face.faceEntryId ? { ...entry, ...values } : entry
    );
    await db.annotations.update(annotationId, { heightCutFaces });
    return face.key;
  }

  // 2. The only face of a closed trace.
  const ringFaces = (faces ?? []).filter(
    (f) => f.heightCutId === face.heightCutId && !f.faceEntryId
  );
  if (face.heightCutId && ringFaces.length <= 1) {
    const heightCuts = (raw.heightCuts ?? []).map((trace) =>
      trace.id === face.heightCutId ? { ...trace, ...values } : trace
    );
    await db.annotations.update(annotationId, { heightCuts });
    return face.key;
  }

  // 3. New seed entry.
  const { width, height } = imageSize ?? {};
  const seed = face.labelPoint;
  if (!width || !height || !seed) return;
  const pointRow = {
    id: nanoid(),
    x: seed.x / width,
    y: seed.y / height,
    projectId: raw.projectId,
    baseMapId: raw.baseMapId,
    listingId: raw.listingId,
  };
  const entry = {
    id: nanoid(),
    points: [{ pointId: pointRow.id }],
    delta: face.delta ?? 0,
    side: face.side ?? HEIGHT_CUT_SIDE_TOP,
    ...values,
  };
  await db.transaction("rw", db.points, db.annotations, async () => {
    await db.points.add(pointRow);
    await db.annotations.update(annotationId, {
      heightCutFaces: [...(raw.heightCutFaces ?? []), entry],
    });
  });
  return `F:${entry.id}`;
}
