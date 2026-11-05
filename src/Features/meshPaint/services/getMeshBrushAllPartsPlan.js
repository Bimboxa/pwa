import {
  BRUSH_MAX_ALL_PARTS,
  MESH_PAINT_PART_TYPES,
} from "Features/meshPaint/constants/meshPaintConstants";
import { getHostPartData } from "Features/meshPaint/js/buildHostPartIndexFromObject";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import listHostEdgeParts from "Features/meshPaint/utils/listHostEdgeParts";
import listHostFaceParts from "Features/meshPaint/utils/listHostFaceParts";
import planPaintAllParts from "Features/meshPaint/utils/planPaintAllParts";

/**
 * three adapter of « Peindre toutes les faces de l'annotation » / « Peindre
 * toutes les arêtes de l'annotation »: what one brush click does on the
 * DISPLAYED object of a host (planPaintAllParts over listHostFaceParts /
 * listHostEdgeParts) — shared by the hover (preview, cursor label) and by
 * the commit (after the host lost its anti-aliasing shrink).
 *
 * A host that is not built (hidden: its paints are still clickable) has no
 * part to list: the plan then covers the clicked part only — and still
 * removes every part of that type and of the armed template on a REMOVED
 * click.
 *
 * @param {object} params
 * @param {object} params.sceneManager
 * @param {"FACE"|"EDGE"} params.partType - the brush's part type
 * @param {string} params.hostId
 * @param {string} params.baseMapId
 * @param {object} params.clickedPart - local geometry of the clicked part
 * @param {{x, y, z}|null} [params.viewDir] - click ray direction (local;
 *   faces of open hosts)
 * @param {object[]} params.rows - effective paint rows of the base map
 * @param {string} params.templateId - the armed template
 * @param {number} [params.smoothAngleDeg] - « Sélection de face » angle
 * @returns {(ReturnType<typeof planPaintAllParts> & {metrics: object,
 *   hash: string|null, isClickedFromIndex: boolean}) | null} null without
 *   frame metrics; hash: geometry hash of the host the parts were read on
 *   (null: host not built); isClickedFromIndex: add[0] is a part of that
 *   host object (not the picked geometry of an unknown part).
 */
export default function getMeshBrushAllPartsPlan({
  sceneManager,
  partType,
  hostId,
  baseMapId,
  clickedPart,
  viewDir = null,
  rows,
  templateId,
  smoothAngleDeg = 0,
}) {
  const imagesManager = sceneManager?.imagesManager;
  const annotationsManager = sceneManager?.annotationsManager;
  const baseMap = imagesManager?.baseMapsMap?.[baseMapId];
  const metrics = getMeshPaintMetrics(baseMap);
  if (!metrics || !clickedPart) return null;

  const root = annotationsManager?.annotationsObjectsMap?.[hostId] ?? null;
  const group = imagesManager.getGroup?.(baseMapId) ?? null;
  const data =
    root && group
      ? getHostPartData({
          root,
          group,
          source: annotationsManager.getAnnotationSource?.(hostId),
          baseMap,
        })
      : null;

  const isFace = partType === MESH_PAINT_PART_TYPES.FACE;
  let listed = { parts: [], clickedIndex: -1, isClosed: true, tooMany: false };
  if (data && isFace) {
    listed = listHostFaceParts(data.getIndex(), {
      smoothAngleDeg,
      clickedFace: clickedPart,
      viewDir,
      maxParts: BRUSH_MAX_ALL_PARTS,
    });
  } else if (data) {
    listed = {
      ...listed,
      ...listHostEdgeParts(data.getIndex(), {
        smoothAngleDeg,
        maxParts: BRUSH_MAX_ALL_PARTS,
      }),
    };
  }

  const plan = planPaintAllParts({
    partType,
    parts: listed.parts,
    clickedIndex: listed.clickedIndex,
    clickedPart,
    isClosed: listed.isClosed,
    hostId,
    baseMapId,
    rows,
    metrics,
    templateId,
  });
  // A host with too many parts only refuses a click that would paint them.
  const tooMany = plan.tooMany || (listed.tooMany && plan.action !== "REMOVED");
  return {
    ...plan,
    ...(tooMany
      ? { action: null, add: [], deleteIds: [], removeRows: [] }
      : null),
    tooMany,
    metrics,
    hash: data?.hash ?? null,
    isClickedFromIndex: plan.clickedIndex >= 0,
  };
}
