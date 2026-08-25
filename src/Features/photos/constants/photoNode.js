// Synthesized photo pseudo-annotations (useAnnotationsV2 `withPhotos`) carry
// this id prefix so no annotation write path (drag, delete, paste, toolbar)
// can ever reach a real db.annotations / db.points row — same guard idea as
// FOREIGN_FOOTPRINT_ID_PREFIX.
export const PHOTO_ID_PREFIX = "photo::";

// Standard camera field of view used at localization; editable later.
export const DEFAULT_FOV_DEG = 60;

export const isPhotoNodeId = (id) =>
  typeof id === "string" && id.startsWith(PHOTO_ID_PREFIX);

export const getPhotoIdFromNodeId = (id) =>
  isPhotoNodeId(id) ? id.slice(PHOTO_ID_PREFIX.length) : null;
