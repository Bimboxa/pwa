import {
  BRUSH_MAX_ALL_PARTS,
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
// l'annotation » / « Peindre toutes les arêtes de l'annotation » on, given
// the parts of the host of the brush's part type (listHostFaceParts /
// listHostEdgeParts) and the rows painting its base map (the brush's
// matching set):
//
// - the clicked part decides, like a plain click (planPaintToggle): it
//   carries the armed template → REMOVED; another template → REPLACED; bare
//   → ADDED;
// - REMOVED: every paint of that part type and of the armed template on the
//   host goes (with the matches of the clicked part); the other part type is
//   left alone (removing the faces keeps the painted edges, and vice versa);
// - ADDED / REPLACED: the clicked part is painted (its matches replaced) and
//   so is every other BARE part of the host. Never a duplicate:
//   - a part already painted (a face: on that side; any template, any host
//     of the base map — findMeshPaintMatches: the corner edge shared by two
//     walls is one edge) is left as it is: another template's paint is never
//     replaced by a part the user did not click;
//   - on an open host (sheet), a face whose OTHER side already carries the
//     armed template is skipped too;
//   - two parts of the batch at the same place (a face stored twice, back to
//     back on an open host) make one row.
//
// Pure: node-testable, relative imports only.

const FACE = MESH_PAINT_PART_TYPES.FACE;

/**
 * @param {object} args
 * @param {"FACE"|"EDGE"} [args.partType] - the brush's part type
 * @param {object[]} args.parts - LocalFaces / LocalEdges of the host
 * @param {number} [args.clickedIndex] - the clicked part in `parts` (-1:
 *   looked for among them — the one at the same place as `clickedPart`)
 * @param {object} args.clickedPart - local geometry of the clicked part
 * @param {boolean} [args.isClosed] - the host is a closed solid (faces)
 * @param {string} args.hostId
 * @param {string} args.baseMapId
 * @param {object[]} args.rows - effective db.meshPaints rows of the base map
 *   (same scope, live host and template, not provisional)
 * @param {{imageWidth, imageHeight, meterByPx}} args.metrics
 * @param {string} args.templateId - the armed template
 * @param {number} [args.maxParts]
 * @returns {{action: "ADDED"|"REPLACED"|"REMOVED"|null,
 *   add: Array<{localGeometry: object, geometry: object}>,
 *   deleteIds: string[], removeRows: object[], clickedIndex: number,
 *   tooMany: boolean}} add[0] is the clicked part; removeRows: the rows of
 *   deleteIds (previews); clickedIndex: the clicked part in `parts` (-1: not
 *   one of them, it is painted as picked).
 */
export default function planPaintAllParts({
  partType = FACE,
  parts,
  clickedIndex = -1,
  clickedPart = null,
  isClosed = false,
  hostId,
  baseMapId,
  rows,
  metrics,
  templateId,
  maxParts = BRUSH_MAX_ALL_PARTS,
}) {
  const none = {
    action: null,
    add: [],
    deleteIds: [],
    removeRows: [],
    clickedIndex: -1,
    tooMany: false,
  };
  if (!metrics || !baseMapId || !templateId) return none;
  const isFace = partType === FACE;
  const list = parts || [];
  const liveRows = (rows || []).filter((row) => row && !row.deletedAt);

  const toCandidate = (localGeometry) => {
    const geometry = localGeometryToPaint(partType, localGeometry, metrics);
    return geometry ? { partType, baseMapId, geometry } : null;
  };
  const prepare = (candidate) =>
    candidate ? prepareMeshPaintMatchItem(candidate, metrics) : null;
  const matchesOf = (candidate, among) =>
    candidate ? findMeshPaintMatches({ candidate, rows: among, metrics }) : [];

  // the clicked part

  const clickedLocal = list[clickedIndex] ?? clickedPart;
  const clicked = toCandidate(clickedLocal);
  const clickedPrepared = prepare(clicked);
  if (!clickedPrepared) return none;
  const toggle = planPaintToggle({
    matches: matchesOf(clicked, liveRows),
    templateId,
  });

  if (toggle.action === "REMOVED") {
    const ids = new Set(toggle.deleteIds);
    for (const row of liveRows) {
      if (
        row.partType === partType &&
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
      clickedIndex: list[clickedIndex] ? clickedIndex : -1,
    };
  }

  // every other bare part

  if (list.length > maxParts) return { ...none, tooMany: true };

  const candidates = list.map(toCandidate);
  const prepared = candidates.map(prepare);
  let clickedAt = list[clickedIndex] ? clickedIndex : -1;
  if (clickedAt < 0) {
    clickedAt = prepared.findIndex(
      (item) => item && isSameMeshPaintPart(item, clickedPrepared)
    );
  }

  const deleted = new Set(toggle.deleteIds);
  const remaining = liveRows.filter((row) => !deleted.has(row.id));
  const add = [{ localGeometry: clickedLocal, geometry: clicked.geometry }];
  const accepted = [clickedPrepared];

  list.forEach((part, i) => {
    if (i === clickedAt || !prepared[i]) return;
    const candidate = candidates[i];
    if (matchesOf(candidate, remaining).length > 0) return;

    // The other side of a sheet: same face.
    const opposite = isFace && !isClosed ? toCandidate(flipFace(part)) : null;
    const preparedOpposite = prepare(opposite);
    if (
      matchesOf(opposite, remaining).some(
        (row) => row.annotationTemplateId === templateId
      )
    ) {
      return;
    }
    const isInBatch = accepted.some(
      (item) =>
        isSameMeshPaintPart(prepared[i], item) ||
        (preparedOpposite && isSameMeshPaintPart(preparedOpposite, item))
    );
    if (isInBatch) return;

    accepted.push(prepared[i]);
    add.push({ localGeometry: part, geometry: candidate.geometry });
  });

  return {
    ...none,
    action: toggle.action,
    add,
    deleteIds: toggle.deleteIds,
    removeRows: liveRows.filter((row) => deleted.has(row.id)),
    clickedIndex: clickedAt,
  };
}
