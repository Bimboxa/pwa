import { BRUSH_MAX_ALL_FACES_PARTS } from "Features/meshPaint/constants/meshPaintConstants";
import { getHostPartData } from "Features/meshPaint/js/buildHostPartIndexFromObject";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import listHostFaceParts from "Features/meshPaint/utils/listHostFaceParts";
import planPaintAllFaces from "Features/meshPaint/utils/planPaintAllFaces";

/**
 * three adapter of « Peindre toutes les faces de l'annotation »: what one
 * brush click does on the DISPLAYED object of a host (planPaintAllFaces over
 * listHostFaceParts) — shared by the hover (preview, cursor label) and by
 * the commit (after the host lost its anti-aliasing shrink).
 *
 * A host that is not built (hidden: its paints are still clickable) has no
 * face to list: the plan then covers the clicked face only — and still
 * removes every face of the armed template on a REMOVED click.
 *
 * @param {object} params
 * @param {object} params.sceneManager
 * @param {string} params.hostId
 * @param {string} params.baseMapId
 * @param {object} params.clickedFace - LocalFace of the clicked part
 * @param {{x, y, z}|null} [params.viewDir] - click ray direction (local)
 * @param {object[]} params.rows - effective paint rows of the base map
 * @param {string} params.templateId - the armed template
 * @param {number} [params.smoothAngleDeg] - « Sélection de face » angle
 * @returns {(ReturnType<typeof planPaintAllFaces> & {metrics: object,
 *   hash: string|null, isClickedFromIndex: boolean}) | null} null without
 *   frame metrics; hash: geometry hash of the host the faces were read on
 *   (null: host not built); isClickedFromIndex: add[0] is a face of that
 *   host object (not the picked geometry as is).
 */
export default function getMeshBrushAllFacesPlan({
  sceneManager,
  hostId,
  baseMapId,
  clickedFace,
  viewDir = null,
  rows,
  templateId,
  smoothAngleDeg = 0,
}) {
  const imagesManager = sceneManager?.imagesManager;
  const annotationsManager = sceneManager?.annotationsManager;
  const baseMap = imagesManager?.baseMapsMap?.[baseMapId];
  const metrics = getMeshPaintMetrics(baseMap);
  if (!metrics || !clickedFace) return null;

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

  const listed = data
    ? listHostFaceParts(data.getIndex(), {
        smoothAngleDeg,
        clickedFace,
        viewDir,
        maxParts: BRUSH_MAX_ALL_FACES_PARTS,
      })
    : { parts: [], clickedIndex: -1, isClosed: true, tooMany: false };

  const plan = planPaintAllFaces({
    parts: listed.parts,
    clickedIndex: listed.clickedIndex,
    clickedFace,
    isClosed: listed.isClosed,
    hostId,
    baseMapId,
    rows,
    metrics,
    templateId,
  });
  // A host with too many faces only refuses a click that would paint them.
  const tooMany = plan.tooMany || (listed.tooMany && plan.action !== "REMOVED");
  return {
    ...plan,
    ...(tooMany
      ? { action: null, add: [], deleteIds: [], removeRows: [] }
      : null),
    tooMany,
    metrics,
    hash: data?.hash ?? null,
    isClickedFromIndex: listed.clickedIndex >= 0,
  };
}
