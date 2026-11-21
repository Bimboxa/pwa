import db from "App/db/db";

import getBaseMapRenderScale, {
  getBaseMapReferenceSize,
} from "Features/baseMaps/js/getBaseMapRenderScale";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import { getShape3DKey } from "../constants/shape3DConfig";
import getAnnotationPropsFromAnnotationTemplateProps from "./getAnnotationPropsFromAnnotationTemplateProps";
import getAnnotationTemplateProps from "./getAnnotationTemplateProps";
import { CUTTER_TYPES, isContactCutter } from "./isVolumeCutter";
import resolveRowsAgainstOwnBaseMap from "./resolveRowsAgainstOwnBaseMap";

// Line refs a light headless resolution leaves unresolved: an annotation
// whose solid depends on them is only buildable from the pipeline's fully
// resolved source.
const UNRESOLVED_LINE_KEYS = [
  "profileLines",
  "guideLines",
  "isoHeightLines",
  "heightCuts",
  "heightCutFaces",
];

const isLive = (row) => Boolean(row) && !row.deletedAt;

const hasItems = (value) => Array.isArray(value) && value.length > 0;

// Whether a light-resolved row (points + holes only) builds the same solid as
// the fully resolved annotation of the pipeline.
export function isLightResolvable(row) {
  if (UNRESOLVED_LINE_KEYS.some((key) => hasItems(row[key]))) return false;
  const shapeKey = getShape3DKey(row.shape3D);
  return shapeKey !== "REVOLUTION" && shapeKey !== "EXTRUSION_PROFILE";
}

// The template merge reads the scale through the BaseMap instance API.
export const asBaseMapForMerge = (baseMap) =>
  baseMap?.getMeterByPx
    ? baseMap
    : { ...baseMap, getMeterByPx: () => getBaseMapRenderScale(baseMap) };

// A raw BLOCK_INSTANCE row stores its anchor bbox normalized: the 3D builder
// reads it in the reference pixels of the instance's base map.
export function resolveBlockInstanceBboxPx(row, baseMap) {
  const size = getBaseMapReferenceSize(baseMap);
  if (!row?.bbox || !size?.width || !size?.height) return row;
  return {
    ...row,
    bbox: {
      x: (Number(row.bbox.x) || 0) * size.width,
      y: (Number(row.bbox.y) || 0) * size.height,
      width: (Number(row.bbox.width) || 0) * size.width,
      height: (Number(row.bbox.height) || 0) * size.height,
    },
  };
}

// What poses an instance on its base map (resolved or raw row alike).
export const getBlockInstancePoseKey = (instance) =>
  [
    instance.id,
    instance.baseMapId,
    instance.bbox?.x,
    instance.bbox?.y,
    instance.bbox?.width,
    instance.bbox?.height,
    instance.rotation ?? 0,
    instance.offsetZ ?? 0,
  ].join(":");

const getPoseKey = (baseMap) => {
  const t = getBaseMapTransform(baseMap);
  return [
    baseMap.id,
    t.orientation,
    t.angleDeg,
    t.position.x,
    t.position.y,
    t.position.z,
    getBaseMapRenderScale(baseMap),
  ].join(":");
};

/**
 * « Soustraire au contact » through block instances (Features/blocks).
 *
 * A member of a block carrying the option (on the annotation or its template)
 * carves wherever the block is instantiated: the INSTANCE is the subtraction
 * operand (relation host → instance), and its solid is made of those members.
 * This resolves, for each given instance, what
 * buildAnnotationSolidObjectsAsync needs to build that solid — to be attached
 * to the instance as `_blockCutters`.
 *
 * Real IndexedDB reads (blocks, members, templates, points): observed when
 * called inside a liveQuery, so an edit of a member re-runs the caller.
 *
 * Members are light-resolved (points + holes, template fields merged): a
 * member whose solid needs more (profile / guide / iso lines, height cuts,
 * REVOLUTION, EXTRUSION_PROFILE) does not carve through instances.
 *
 * @param {Array<Object>} instances rows (raw or resolved) with
 *   `instanceOfBlockId`
 * @param {Object} baseMapById BaseMap instances or plain records, by id
 *   (must hold the blocks base maps)
 * @returns {Promise<Map<string, {cutters: Object, key: string}>>} by instance
 *   id — instances whose block has no carving member are absent. `cutters`
 *   is shared by the instances of a block (never mutate it); `key` changes
 *   whenever the block's carving solid may have changed.
 */
export default async function getBlockCuttersByInstanceId(
  instances,
  baseMapById
) {
  const result = new Map();
  const blockIds = [
    ...new Set(
      (instances ?? []).map((i) => i?.instanceOfBlockId).filter(Boolean)
    ),
  ];
  if (blockIds.length === 0) return result;

  const blocks = (await db.blocks.bulkGet(blockIds)).filter(
    (b) => isLive(b) && b.origin?.baseMapId && baseMapById[b.origin.baseMapId]
  );
  if (blocks.length === 0) return result;

  const memberRows = (
    await db.annotations
      .where("blockId")
      .anyOf(blocks.map((b) => b.id))
      .toArray()
  ).filter(
    (m) =>
      isLive(m) &&
      CUTTER_TYPES.includes(m.type) &&
      !m.isOpening &&
      !m.isMeshCell &&
      baseMapById[m.baseMapId]
  );
  if (memberRows.length === 0) return result;

  const templateIds = [
    ...new Set(memberRows.map((m) => m.annotationTemplateId).filter(Boolean)),
  ];
  const templateById = new Map();
  if (templateIds.length > 0) {
    const found = await db.annotationTemplates.bulkGet(templateIds);
    templateIds.forEach((id, i) =>
      templateById.set(id, isLive(found[i]) ? found[i] : null)
    );
  }

  const flaggedRows = memberRows.filter(
    (m) =>
      (m.subtractOnContact === true ||
        templateById.get(m.annotationTemplateId)?.subtractOnContact === true) &&
      isLightResolvable(m)
  );
  if (flaggedRows.length === 0) return result;

  const resolvedById = await resolveRowsAgainstOwnBaseMap(
    flaggedRows,
    baseMapById,
    { withCuts: true }
  );

  const cuttersByBlockId = new Map();
  for (const block of blocks) {
    const originBaseMap = baseMapById[block.origin.baseMapId];
    const originBaseMapForRender = getBaseMapForRender(originBaseMap);
    if (!originBaseMapForRender) continue;

    const members = [];
    const keyParts = [
      block.id,
      block.origin.x,
      block.origin.y,
      block.origin.z ?? 0,
      getPoseKey(originBaseMap),
    ];
    for (const row of flaggedRows) {
      if (row.blockId !== block.id) continue;
      const resolved = resolvedById.get(row.id);
      if (!resolved) continue;
      const baseMap = baseMapById[row.baseMapId];
      const template = templateById.get(row.annotationTemplateId);
      const annotation = template
        ? getAnnotationPropsFromAnnotationTemplateProps(
            resolved,
            getAnnotationTemplateProps(template),
            asBaseMapForMerge(baseMap)
          )
        : resolved;
      if (!isContactCutter(annotation)) continue;
      members.push({
        annotation,
        baseMapForRender: getBaseMapForRender(baseMap),
        baseMapTransform: getBaseMapTransform(baseMap),
      });
      keyParts.push(
        row.id,
        row.updatedAt ?? "",
        template?.updatedAt ?? "",
        getPoseKey(baseMap)
      );
    }
    if (members.length === 0) continue;

    cuttersByBlockId.set(block.id, {
      cutters: {
        blockId: block.id,
        originBaseMapId: originBaseMap.id,
        originBaseMapForRender,
        originBaseMapTransform: getBaseMapTransform(originBaseMap),
        originPx: {
          x: block.origin.x * originBaseMapForRender.imageWidth,
          y: block.origin.y * originBaseMapForRender.imageHeight,
        },
        originZ: Number(block.origin.z) || 0,
        members,
      },
      key: keyParts.join("|"),
    });
  }

  for (const instance of instances ?? []) {
    const entry = cuttersByBlockId.get(instance?.instanceOfBlockId);
    if (entry && instance.id) result.set(instance.id, entry);
  }
  return result;
}
