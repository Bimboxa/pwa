// entityModel of COMMENT listings ("Liste de commentaires"). Org appConfig
// YAMLs replace the default config entirely (no merge), so comment listings
// do not depend on appConfig: the entityModel is denormalized onto the
// listing at creation (same rule as BUSINESS_OBJECT_ENTITY_MODEL).
export const COMMENT_ENTITY_MODEL_KEY = "comment";

export const COMMENT_ENTITY_MODEL = {
  key: COMMENT_ENTITY_MODEL_KEY,
  name: "Commentaires",
  type: "COMMENT",
  defaultTable: "comments",
  defaultListingName: "Commentaires",
  strings: {
    labelNew: "Nouvelle liste de commentaires",
  },
};

export const COMMENTS_MODULE_KEY = "COMMENTS";

export function isCommentListing(listing) {
  return listing?.entityModelKey === COMMENT_ENTITY_MODEL_KEY;
}
