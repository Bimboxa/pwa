import {
  BRUSH_MAX_ALL_FACES_PARTS,
  MESH_PAINT_PART_TYPES,
} from "../constants/meshPaintConstants.js";

import findMeshPaintMatches, {
  isSameMeshPaintPart,
  prepareMeshPaintMatchItem,
} from "./findMeshPaintMatches.js";
import { localGeometryToPaint } from "./meshPaintFrame.js";
import { flipFace } from "./meshPaintGeometry.js";
import planPaintToggle from "./planPaintToggle.js";

// What ONE brush click does with « Peindre toutes les faces de
// l'annotation » on, given the faces of the host (listHostFaceParts) and the
// rows painting its base map (the brush's matching set):
//
// - the clicked face decides, like a plain click (planPaintToggle): it
//   carries the armed template → REMOVED; another template → REPLACED; bare
//   → ADDED;
// - REMOVED: every FACE paint of the armed template on the host goes (with
//   the matches of the clicked face); edges are left alone;
// - ADDED / REPLACED: the clicked face is painted (its matches replaced) and
//   so is every other BARE face of the host. Never a duplicate:
//   - a face already painted on that side (any template, any host of the
//     base map — findMeshPaintMatches) is left as it is: another template's
//     paint is never replaced by a face the user did not click;
//   - on an open host (sheet), a face whose OTHER side already carries the
//     armed template is skipped too;
//   - two faces of the batch at the same place (stored twice, back to back
//     on an open host) make one row.
//
// Pure: node-testable, relative imports only.

const FACE = MESH_PAINT_PART_TYPES.FACE;

/**
 * @param {object} args
 * @param {object[]} args.parts - LocalFaces of the host (listHostFaceParts)
 * @param {number} args.clickedIndex - the clicked part in `parts` (-1: not
 *   one of them — `clickedFace` is then painted as its own part)
 * @param {object} args.clickedFace - LocalFace of the clicked part
 * @param {boolean} args.isClosed - the host is a closed solid
 * @param {string} args.hostId
 * @param {string} args.baseMapId
 * @param {object[]} args.rows - effective db.meshPaints rows of the base map
 *   (same scope, live host and template, not provisional)
 * @param {{imageWidth, imageHeight, meterByPx}} args.metrics
 * @param {string} args.templateId - the armed template
 * @param {number} [args.maxParts]
 * @returns {{action: "ADDED"|"REPLACED"|"REMOVED"|null,
 *   add: Array<{localGeometry: object, geometry: object}>,
 *   deleteIds: string[], removeRows: object[], tooMany: boolean}} add[0] is
 *   the clicked face; removeRows: the rows of deleteIds (previews).
 */
export default function planPaintAllFaces({
  parts,
  clickedIndex = -1,
  clickedFace = null,
  isClosed = false,
  hostId,
  baseMapId,
  rows,
  metrics,
  templateId,
  maxParts = BRUSH_MAX_ALL_FACES_PARTS,
}) {
  const none = {
    action: null,
    add: [],
    deleteIds: [],
    removeRows: [],
    tooMany: false,
  };
  if (!metrics || !baseMapId || !templateId) return none;
  const list = parts || [];
  const liveRows = (rows || []).filter((row) => row && !row.deletedAt);

  const toCandidate = (localGeometry) => {
    const geometry = localGeometryToPaint(FACE, localGeometry, metrics);
    return geometry ? { partType: FACE, baseMapId, geometry } : null;
  };
  const matchesOf = (candidate, among) =>
    candidate ? findMeshPaintMatches({ candidate, rows: among, metrics }) : [];

  // the clicked face

  const clickedLocal = list[clickedIndex] ?? clickedFace;
  const clicked = toCandidate(clickedLocal);
  if (!clicked) return none;
  const toggle = planPaintToggle({
    matches: matchesOf(clicked, liveRows),
    templateId,
  });

  if (toggle.action === "REMOVED") {
    const ids = new Set(toggle.deleteIds);
    for (const row of liveRows) {
      if (
        row.partType === FACE &&
        row.hostAnnotationId === hostId &&
        row.annotationTemplateId === templateId
      ) {
        ids.add(row.id);
      }
    }
    return {
      ...none,
      action: "REMOVED",
      deleteIds: [...ids],
      removeRows: liveRows.filter((row) => ids.has(row.id)),
    };
  }

  // every other bare face

  if (list.length > maxParts) return { ...none, tooMany: true };

  const deleted = new Set(toggle.deleteIds);
  const remaining = liveRows.filter((row) => !deleted.has(row.id));
  const add = [{ localGeometry: clickedLocal, geometry: clicked.geometry }];
  const accepted = [prepareMeshPaintMatchItem(clicked, metrics)];

  list.forEach((part, i) => {
    if (i === clickedIndex) return;
    const candidate = toCandidate(part);
    const prepared = candidate
      ? prepareMeshPaintMatchItem(candidate, metrics)
      : null;
    if (!prepared) return;
    if (matchesOf(candidate, remaining).length > 0) return;

    // The other side of a sheet: same face.
    const opposite = isClosed ? null : toCandidate(flipFace(part));
    const preparedOpposite = opposite
      ? prepareMeshPaintMatchItem(opposite, metrics)
      : null;
    if (
      matchesOf(opposite, remaining).some(
        (row) => row.annotationTemplateId === templateId
      )
    ) {
      return;
    }
    const isInBatch = accepted.some(
      (item) =>
        isSameMeshPaintPart(prepared, item) ||
        (preparedOpposite && isSameMeshPaintPart(preparedOpposite, item))
    );
    if (isInBatch) return;

    accepted.push(prepared);
    add.push({ localGeometry: part, geometry: candidate.geometry });
  });

  return {
    ...none,
    action: toggle.action,
    add,
    deleteIds: toggle.deleteIds,
    removeRows: liveRows.filter((row) => deleted.has(row.id)),
  };
}
