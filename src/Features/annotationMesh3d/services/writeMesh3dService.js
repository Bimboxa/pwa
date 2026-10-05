import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { clearItemPartSelection } from "Features/selection/selectionSlice";
import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import { localToNormalized, mesh3dFromLocal } from "../utils/mesh3dFrame";
import { buildMesh3dSource } from "../utils/mesh3dSource";
import projectMesh3dToRings from "../utils/projectMesh3dToRings";

// Geometry fields of the row a mesh replaces: once an annotation is a mesh,
// its 3D solid is `mesh3d` and its 2D points are the plan projection — the
// parametric leftovers would only desynchronize readers.
const CLEARED_ARRAY_FIELDS = [
  "innerPoints",
  "guideLines",
  "isoHeightLines",
  "profileLines",
  "hiddenSegmentsIdx",
  "isoHeightSegmentsIdx",
  "isExtEdgeSegmentsIdx",
  "isIntEdgeSegmentsIdx",
  "isNotchSegmentsIdx",
  "hiddenSegmentsPointIds",
  "isoHeightSegmentsPointIds",
  "isExtEdgeSegmentsPointIds",
  "isIntEdgeSegmentsPointIds",
  "isNotchSegmentsPointIds",
];

// Storage fields of a mesh: the stored mesh (normalized), the offsetZ it
// stands on and its plan projection as fresh db.points rows + refs.
//
// The points are always NEW rows, never reused: a projection vertex shared
// with a neighbor annotation would deform the polygon (but not the mesh) as
// soon as that neighbor is edited.
export function buildMesh3dStorage({
  mesh,
  baseOffsetZ,
  metrics,
  baseMapId,
  projectId,
  listingId,
}) {
  const { mesh3d, offsetZ } = mesh3dFromLocal(mesh, metrics, baseOffsetZ);
  const rings = projectMesh3dToRings(mesh);
  if (!rings) return null;

  const pointRows = [];
  const toRefs = (loop) =>
    loop.map((p) => {
      const [x, y] = localToNormalized({ x: p.x, y: p.y, z: 0 }, metrics);
      const id = nanoid();
      pointRows.push({
        id,
        x,
        y,
        projectId,
        baseMapId,
        ...(listingId ? { listingId } : {}),
      });
      return { id, type: "square" };
    });

  return {
    mesh3d,
    offsetZ,
    points: toRefs(rings.contour),
    cuts: rings.holes.map((hole) => ({ id: nanoid(), points: toRefs(hole) })),
    pointRows,
  };
}

// THE write path of an annotation mesh — conversion of a regular annotation,
// split by a drawn line, push/pull: stores the mesh and re-derives the 2D
// polygon from it. The annotation keeps its id, template and listing; its
// type becomes POLYGON.
//
// The FIRST write of a regular annotation (its conversion) also snapshots its
// original 2D geometry in `mesh3dSource`, which resetMesh3dAnnotationService
// restores.
//
// Undo: the point rows are written outside the undo stack and the replaced
// ones are left in place (orphans, reclaimed by the purge), so ONE undo step
// — the annotation row — restores the previous geometry, references
// included.
//
// annotation: db row. mesh: LOCAL mesh, z relative to baseOffsetZ.
export default async function writeMesh3dService({
  annotation,
  mesh,
  baseOffsetZ = 0,
  metrics,
  dispatch,
}) {
  if (!annotation?.id || !mesh?.faces?.length || !metrics) return null;

  const storage = buildMesh3dStorage({
    mesh,
    baseOffsetZ,
    metrics,
    baseMapId: annotation.baseMapId,
    projectId: annotation.projectId,
    listingId: annotation.listingId,
  });
  if (!storage) return null;
  const { pointRows, ...fields } = storage;

  const patch = {
    ...fields,
    type: "POLYGON",
    isMesh3d: true,
    height: 0,
  };
  for (const key of CLEARED_ARRAY_FIELDS) {
    if (annotation[key]?.length) patch[key] = [];
  }
  if (annotation.rotation || annotation.rotationCenter) {
    patch.rotation = 0;
    patch.rotationCenter = null;
  }

  // First conversion of a stroke-driven annotation (thick wall, strip): a
  // POLYGON is fill-driven, so carry its effective color over.
  if (!annotation.isMesh3d && annotation.type !== "POLYGON") {
    const template = annotation.annotationTemplateId
      ? await db.annotationTemplates.get(annotation.annotationTemplateId)
      : null;
    const locked = (key) =>
      Array.isArray(template?.overrideFields) &&
      template.overrideFields.includes(key) &&
      template[key] != null;
    const strokeColor = locked("strokeColor")
      ? template.strokeColor
      : annotation.strokeColor;
    const strokeOpacity = locked("strokeOpacity")
      ? template.strokeOpacity
      : annotation.strokeOpacity;
    if (!annotation.fillColor && strokeColor) patch.fillColor = strokeColor;
    if (annotation.fillOpacity == null && strokeOpacity != null) {
      patch.fillOpacity = strokeOpacity;
    }
  }

  // Conversion: keep what the mesh replaces, to be able to revert it.
  if (!annotation.isMesh3d) {
    const ids = [
      ...(annotation.points || []),
      ...(annotation.cuts || []).flatMap((cut) => cut?.points || []),
      ...(annotation.innerPoints || []),
    ]
      .map((ref) => ref?.id)
      .filter(Boolean);
    const rows = ids.length ? await db.points.bulkGet(ids) : [];
    const pointsById = new Map();
    for (const row of rows) {
      if (row) pointsById.set(row.id, { x: row.x, y: row.y });
    }
    patch.mesh3dSource = buildMesh3dSource({ annotation, patch, pointsById });
  }

  await withoutUndo(() => db.points.bulkAdd(pointRows));
  await db.annotations.update(annotation.id, patch);

  dispatch?.(triggerAnnotationsUpdate());
  dispatch?.(bumpSnapIndexEpoch());
  // Faces and vertices were renumbered: a face / edge selection made on the
  // previous mesh would now point at other parts.
  dispatch?.(clearItemPartSelection(annotation.id));
  return { ...annotation, ...patch };
}
