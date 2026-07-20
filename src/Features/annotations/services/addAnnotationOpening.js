import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

/**
 * Creates an opening relation between a host wall annotation and an opening
 * annotation glued on one of its segments. The anchor payload records which
 * host segment carries the opening and at which fixed distance (meters) from
 * the reference vertex (hostSegmentStartPointId) its center sits.
 *
 * Guards against self-links and duplicate (non-deleted) pairs.
 *
 * @param {Object} args
 * @param {string} args.projectId
 * @param {string} args.hostAnnotationId
 * @param {string} args.openingAnnotationId
 * @param {string} args.hostSegmentStartPointId - reference vertex point id
 * @param {string} args.hostSegmentEndPointId
 * @param {string|null} [args.hostArcControlPointId] - S-C-S control point id (arc host)
 * @param {number} args.hostDistanceM - opening center distance from reference vertex, meters
 * @param {Object} [args.carve] - { mode: "CONTOUR", notchPointIds } | { mode: "CUT", cutId } | { mode: "NONE" }
 * @returns {Promise<string|null>} the created relation id, or null if skipped
 */
export default async function addAnnotationOpening({
  projectId,
  hostAnnotationId,
  openingAnnotationId,
  hostSegmentStartPointId,
  hostSegmentEndPointId,
  hostArcControlPointId = null,
  hostDistanceM,
  carve = { mode: "NONE" },
}) {
  if (!projectId || !hostAnnotationId || !openingAnnotationId) return null;
  if (hostAnnotationId === openingAnnotationId) return null;

  // Skip if a non-deleted relation already exists for this pair.
  const existing = await db.relAnnotationOpenings
    .where("openingAnnotationId")
    .equals(openingAnnotationId)
    .toArray();
  const alreadyExists = existing.some(
    (r) => !r.deletedAt && r.hostAnnotationId === hostAnnotationId
  );
  if (alreadyExists) return null;

  const id = nanoid();
  await db.relAnnotationOpenings.add({
    id,
    projectId,
    hostAnnotationId,
    openingAnnotationId,
    hostSegmentStartPointId,
    hostSegmentEndPointId,
    hostArcControlPointId,
    hostDistanceM,
    carve,
  });
  return id;
}
