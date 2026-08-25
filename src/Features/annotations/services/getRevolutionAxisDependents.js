import db from "App/db/db";

// Annotations of ONE base map that revolve around a given axis, i.e. what would
// silently lose its revolution if the axis were removed from that base map.
//
// Scoped to the base map on purpose: an arc only revolves when a
// REVOLUTION_AXIS_PLACEMENT of its axis sits on its OWN base map (that
// placement is what poses the plane and resolves the lathe axis — see
// useAnnotationsV2). Delete the placement and those arcs fall back to plain
// extruded walls.
export default async function getRevolutionAxisDependents({
  axisId,
  baseMapId,
}) {
  if (!axisId || !baseMapId) return { arcs: [] };

  const arcs = (
    await db.annotations.where("baseMapId").equals(baseMapId).toArray()
  ).filter((a) => !a.deletedAt && a.shape3D?.axisAnnotationId === axisId);

  return { arcs };
}
