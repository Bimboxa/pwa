import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import { getScopeIdByListingId } from "Features/annotations/utils/isRevolutionHelperInScope";

import {
  isBaseMapLinkInScope,
  isBaseMapLinkSource,
} from "../utils/baseMapLinkPredicates";
import getNextBaseMapLinkLabel from "../utils/getNextBaseMapLinkLabel";
import { buildBaseMapLinkDraft } from "../utils/startBaseMapLinkTools";

const STYLE_KEYS = [
  "strokeColor",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeOpacity",
];

// 3D two-click section mark ("trait de coupe") → the SAME source
// BASE_MAP_LINK row the 2D tool commits (useHandleCommitDrawing):
//   - the two world points are projected onto the plane of the HORIZONTAL
//     host plan (their distance to the plane is dropped: a mark lives on its
//     plan) and stored as two fresh db.points rows, normalized against the
//     host image size — a mark never shares a vertex;
//   - template-less row bound to the scope (scopeId, listingId null);
//   - label = the first free letter pair of the scope ("A-A", "B-B"…).
//
// `host` is a BaseMap instance or record (image size + meterByPx + pose).
// `createAnnotationFn` = useCreateAnnotation (writes the point rows in the
// same transaction). Returns the created annotation record, or null.
export default async function commitDrawnBaseMapLinkService({
  a,
  b,
  host,
  projectId,
  scopeId,
  draft,
  createAnnotationFn,
}) {
  if (!a || !b || !host || !projectId || !createAnnotationFn) return null;
  if (host.orientation === "VERTICAL" || host.isPhoto) return null;

  const aN = worldToBaseMapNormalized(a, host);
  const bN = worldToBaseMapNormalized(b, host);
  if (!aN || !bN) return null;
  // Two clicks above one another project onto the same plan point.
  if (Math.hypot(bN.x - aN.x, bN.y - aN.y) < 1e-9) return null;

  const linkRows = (
    await db.annotations.where("projectId").equals(projectId).toArray()
  ).filter((row) => !row.deletedAt && isBaseMapLinkSource(row));
  const scopeIdByListingId = await getScopeIdByListingId(linkRows);
  const label = getNextBaseMapLinkLabel(
    linkRows
      .filter((row) =>
        isBaseMapLinkInScope(row, { scopeId, scopeIdByListingId })
      )
      .map((row) => row.label)
  );

  const pointRows = [aN, bN].map((p) => ({
    id: nanoid(),
    x: p.x,
    y: p.y,
    baseMapId: host.id,
    projectId,
    listingId: null,
  }));

  const style = {};
  STYLE_KEYS.forEach((key) => {
    if (draft?.[key] !== undefined && draft?.[key] !== null) {
      style[key] = draft[key];
    }
  });

  const annotation = {
    ...buildBaseMapLinkDraft(),
    ...style,
    id: nanoid(),
    projectId,
    baseMapId: host.id,
    scopeId: scopeId ?? null,
    listingId: null,
    points: pointRows.map((row) => ({ id: row.id })),
    label,
  };

  return await createAnnotationFn(annotation, { pointRowsToSave: pointRows });
}
