import { nanoid } from "@reduxjs/toolkit";

import { COMMENT_BLOCK_TYPES } from "../constants/commentBlocks";

// Infos seeded by a Krto configuration (`configuration.comments`).
//
// A comment row references database ids (base maps, annotation templates,
// listings) that differ in every project — and some of their targets do not
// exist yet when the scope is created (pages created later by a procedure).
// So a configuration stores a SEED where every id is replaced by a stable
// key, and the comment keeps that seed (`comment.seedRefs`) until all its
// keys are resolved (bindSeededCommentsService):
//
//  - listing            → `listing.key` (library key, within the scope)
//  - annotation template → { listingKey, templateKey } (`templateKey` is
//                          persisted on the templates created from a library)
//  - base map           → `baseMap.key` (with `keyScopeId` = the scope)
//
// Seed of one comment:
//   { title,
//     blocks: [ TEXT / LINK / YOUTUBE / COMMAND blocks as they are,
//       { type: "DRAW_ACTION", toolKey, label,
//         templateRef: { listingKey, templateKey } },
//       { type: "PROCEDURE_ACTION", listingKey, procedureKey },
//       { type: "TEMPLATES_LIST", templateRefs: [{ listingKey, templateKey }] } ],
//     location: null | { baseMapKey, point: {x, y} | null,
//                        worldPosition: {x, y, z} | null },
//     viewContext: { moduleKey, isBlocksContext, viewerMode, aspectRatio,
//       mainBaseMapKey, visibleBaseMapKeysIn3d,
//       visibleTemplateKeys: { [listingKey]: [templateKey] },
//       hideMainBaseMapImageIn3d, hideMainBaseMapAnnotationsIn3d,
//       mainBaseMapOpacity,
//       camera2d: null | { footprintNormalized: { cx, cy, width, height } },
//       camera3d,
//       extras: { …, hiddenListingKeys, visibleBaseMapKeysIn2d,
//                 annotationsBaseMapKeysIn2d } } }
//
// The 2D camera frame is stored normalized ([0..1] of the base map) so it
// fits a page whose pixel size differs. Base map versions are not seeded: a
// restored view keeps the active version of the page. IMAGE blocks are not
// supported (their file lives in db.files).
//
// The two functions below are pure. Their context:
//   toSeed:   { listingKeyById: Map, templateRefById: Map<id, {listingKey,
//               templateKey}>, baseMapById: Map<id, record> }
//   fromSeed: { listingIdByKey: Map, templateIdByRef: Map<"listingKey:
//               templateKey", id>, baseMapByKey: Map<key, record> }

export const getTemplateRefKey = (ref) =>
  `${ref?.listingKey ?? ""}:${ref?.templateKey ?? ""}`;

const getBaseMapSize = (baseMap) => ({
  width: baseMap?.refWidth ?? baseMap?.image?.imageSize?.width ?? null,
  height: baseMap?.refHeight ?? baseMap?.image?.imageSize?.height ?? null,
});

// ---------------------------------------------------------------------------
// comment → seed (ids → keys)
// ---------------------------------------------------------------------------

export function commentToSeed(comment, context, warnings = []) {
  const { listingKeyById, templateRefById, baseMapById } = context;
  const where = `« ${comment.title || "Sans titre"} »`;

  const listingKey = (id, what) => {
    const key = id ? listingKeyById.get(id) : null;
    if (id && !key) warnings.push(`${where}: ${what} sans clé (${id})`);
    return key ?? null;
  };
  const templateRef = (id, what) => {
    const ref = id ? templateRefById.get(id) : null;
    if (id && !ref) warnings.push(`${where}: ${what} sans clé (${id})`);
    return ref ?? null;
  };
  const baseMapKey = (id, what) => {
    const key = id ? baseMapById.get(id)?.key : null;
    if (id && !key) warnings.push(`${where}: ${what} sans clé (${id})`);
    return key ?? null;
  };
  const baseMapKeys = (ids, what) =>
    (ids ?? []).map((id) => baseMapKey(id, what)).filter(Boolean);

  // blocks
  const blocks = [];
  for (const block of comment.blocks ?? []) {
    // ids are minted again at seeding
    const rest = { ...block };
    delete rest.id;
    if (block.type === COMMENT_BLOCK_TYPES.IMAGE) {
      warnings.push(`${where}: bloc image non exporté`);
    } else if (block.type === COMMENT_BLOCK_TYPES.DRAW_ACTION) {
      // the listing is the template's own
      const { annotationTemplateId, ...props } = rest;
      delete props.listingId;
      blocks.push({
        ...props,
        templateRef: templateRef(annotationTemplateId, "modèle d'annotation"),
      });
    } else if (block.type === COMMENT_BLOCK_TYPES.PROCEDURE_ACTION) {
      const { listingId, ...props } = rest;
      blocks.push({ ...props, listingKey: listingKey(listingId, "liste") });
    } else if (block.type === COMMENT_BLOCK_TYPES.TEMPLATES_LIST) {
      const { annotationTemplateIds, ...props } = rest;
      blocks.push({
        ...props,
        templateRefs: (annotationTemplateIds ?? [])
          .map((id) => templateRef(id, "modèle d'annotation"))
          .filter(Boolean),
      });
    } else {
      blocks.push(rest);
    }
  }

  // location
  const location = comment.location
    ? {
        baseMapKey: baseMapKey(comment.location.baseMapId, "fond de plan"),
        point: comment.location.point ?? null,
        worldPosition: comment.location.worldPosition ?? null,
      }
    : null;

  // view context
  const vc = comment.viewContext ?? {};
  const mainBaseMapId = vc.baseMaps?.mainBaseMapId ?? null;
  const mainSize = getBaseMapSize(baseMapById.get(mainBaseMapId));
  const footprint = vc.camera2d?.footprint;
  const camera2d =
    footprint && mainSize.width && mainSize.height
      ? {
          footprintNormalized: {
            cx: footprint.cx / mainSize.width,
            cy: footprint.cy / mainSize.height,
            width: footprint.width / mainSize.width,
            height: footprint.height / mainSize.height,
          },
        }
      : null;

  // visible templates, by listing key. The templates without a key (drawn
  // outside the configuration's libraries) are left out silently: they do
  // not exist in a new Krto.
  const visibleTemplateKeys = {};
  for (const id of vc.visibleAnnotationTemplateIds ?? []) {
    const ref = templateRefById.get(id);
    if (!ref) continue;
    (visibleTemplateKeys[ref.listingKey] ??= []).push(ref.templateKey);
  }

  const {
    hiddenListingsIds,
    visibleBaseMapIdsIn2d,
    annotationsBaseMapIdsIn2d,
    ...extras
  } = vc.extras ?? {};

  const viewContext = {
    moduleKey: vc.moduleKey ?? null,
    isBlocksContext: Boolean(vc.isBlocksContext),
    viewerMode: vc.viewerMode ?? "MAP",
    aspectRatio: vc.aspectRatio ?? null,
    mainBaseMapKey: baseMapKey(mainBaseMapId, "fond de plan de la vue"),
    visibleBaseMapKeysIn3d: baseMapKeys(
      vc.baseMaps?.visibleBaseMapIdsIn3d,
      "fond de plan affiché en 3D"
    ),
    visibleTemplateKeys,
    hideMainBaseMapImageIn3d: Boolean(vc.baseMaps?.hideMainBaseMapImageIn3d),
    hideMainBaseMapAnnotationsIn3d: Boolean(
      vc.baseMaps?.hideMainBaseMapAnnotationsIn3d
    ),
    mainBaseMapOpacity: vc.baseMaps?.mainBaseMapOpacity ?? 1,
    camera2d,
    camera3d: vc.camera3d ?? null,
    extras: {
      ...extras,
      hiddenListingKeys: (hiddenListingsIds ?? [])
        .map((id) => listingKeyById.get(id))
        .filter(Boolean),
      visibleBaseMapKeysIn2d: baseMapKeys(
        visibleBaseMapIdsIn2d,
        "fond de plan affiché en 2D"
      ),
      annotationsBaseMapKeysIn2d: baseMapKeys(
        annotationsBaseMapIdsIn2d,
        "fond de plan d'annotations en 2D"
      ),
    },
  };

  return { title: comment.title ?? "", blocks, location, viewContext };
}

// ---------------------------------------------------------------------------
// seed → comment fields (keys → ids)
// ---------------------------------------------------------------------------

// Gives each seed block its own id, once, when the comment is seeded.
export function withSeedBlockIds(seed) {
  return {
    ...seed,
    blocks: (seed.blocks ?? []).map((block) => ({
      ...block,
      id: block.id ?? nanoid(),
    })),
  };
}

// → { fields: { blocks?, location, viewContext }, pending }
// `pending`: at least one key has no target yet (the binding runs again).
// `seed.blocks` null = the user edited the blocks: they are left alone.
export function resolveCommentSeed(seed, context) {
  const { listingIdByKey, templateIdByRef, baseMapByKey } = context;
  let pending = false;

  const listingId = (key) => {
    if (!key) return null;
    const id = listingIdByKey.get(key) ?? null;
    if (!id) pending = true;
    return id;
  };
  const templateId = (ref) => {
    if (!ref) return null;
    const id = templateIdByRef.get(getTemplateRefKey(ref)) ?? null;
    if (!id) pending = true;
    return id;
  };
  const baseMap = (key) => {
    if (!key) return null;
    const record = baseMapByKey.get(key) ?? null;
    if (!record) pending = true;
    return record;
  };
  const baseMapIds = (keys) =>
    (keys ?? []).map((key) => baseMap(key)?.id).filter(Boolean);

  const fields = {};

  // blocks
  if (Array.isArray(seed.blocks)) {
    fields.blocks = seed.blocks.map((block) => {
      if (block.type === COMMENT_BLOCK_TYPES.DRAW_ACTION) {
        const { templateRef, ...props } = block;
        return {
          label: "",
          toolKey: null,
          ...props,
          annotationTemplateId: templateId(templateRef),
          listingId: listingId(templateRef?.listingKey),
        };
      }
      if (block.type === COMMENT_BLOCK_TYPES.PROCEDURE_ACTION) {
        const { listingKey, ...props } = block;
        return { ...props, listingId: listingId(listingKey) };
      }
      if (block.type === COMMENT_BLOCK_TYPES.TEMPLATES_LIST) {
        const { templateRefs, ...props } = block;
        return {
          ...props,
          annotationTemplateIds: (templateRefs ?? [])
            .map(templateId)
            .filter(Boolean),
        };
      }
      return block;
    });
  }

  // location
  if (seed.location) {
    const record = baseMap(seed.location.baseMapKey);
    fields.location = {
      baseMapId: record?.id ?? null,
      point: seed.location.point ?? null,
      worldPosition: seed.location.worldPosition ?? null,
    };
  } else {
    fields.location = null;
  }

  // view context
  const vc = seed.viewContext ?? {};
  const main = baseMap(vc.mainBaseMapKey);
  const mainSize = getBaseMapSize(main);
  const normalized = vc.camera2d?.footprintNormalized;
  const camera2d =
    normalized && mainSize.width && mainSize.height
      ? {
          footprint: {
            cx: normalized.cx * mainSize.width,
            cy: normalized.cy * mainSize.height,
            width: normalized.width * mainSize.width,
            height: normalized.height * mainSize.height,
          },
        }
      : null;

  const visibleAnnotationTemplateIds = [];
  for (const [listingKey, templateKeys] of Object.entries(
    vc.visibleTemplateKeys ?? {}
  )) {
    for (const templateKey of templateKeys ?? []) {
      const id = templateId({ listingKey, templateKey });
      if (id) visibleAnnotationTemplateIds.push(id);
    }
  }

  const {
    hiddenListingKeys,
    visibleBaseMapKeysIn2d,
    annotationsBaseMapKeysIn2d,
    ...extras
  } = vc.extras ?? {};

  fields.viewContext = {
    moduleKey: vc.moduleKey ?? null,
    isBlocksContext: Boolean(vc.isBlocksContext),
    viewerMode: vc.viewerMode ?? "MAP",
    aspectRatio: vc.aspectRatio ?? null,
    hiddenAnnotationTemplateIds: [],
    visibleAnnotationTemplateIds,
    baseMaps: {
      mainBaseMapId: main?.id ?? null,
      // versions are not seeded: the page keeps its active one
      activeVersionIdByBaseMapId: {},
      visibleBaseMapIdsIn3d: baseMapIds(vc.visibleBaseMapKeysIn3d),
      visibleBaseMapIds: main?.id ? [main.id] : [],
      hideMainBaseMapImageIn3d: Boolean(vc.hideMainBaseMapImageIn3d),
      hideMainBaseMapAnnotationsIn3d: Boolean(
        vc.hideMainBaseMapAnnotationsIn3d
      ),
      mainBaseMapOpacity: vc.mainBaseMapOpacity ?? 1,
    },
    camera2d,
    camera3d: vc.camera3d ?? null,
    extras: {
      ...extras,
      hiddenListingsIds: (hiddenListingKeys ?? [])
        .map((key) => listingId(key))
        .filter(Boolean),
      visibleBaseMapIdsIn2d: baseMapIds(visibleBaseMapKeysIn2d),
      annotationsBaseMapIdsIn2d: baseMapIds(annotationsBaseMapKeysIn2d),
    },
  };

  return { fields, pending };
}
