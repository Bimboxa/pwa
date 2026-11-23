import { commentToSeed } from "../utils/commentSeedRefs";

import getCommentSeedContextService from "./getCommentSeedContextService";

// Fallback key of a listing created by hand: its name, as a constant.
const toKey = (name) =>
  (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "INFOS";

// The infos of a listing as the `comments` section of a Krto configuration
// (seedConfigurationCommentsService): every id is replaced by the key of its
// target (utils/commentSeedRefs.js). A target without a key cannot be seeded:
// it is reported in `warnings` — the listing must be written in a Krto
// created from the configuration, where everything carries one.
//
// → { listings: [{ key, name, comments }], warnings }
export default async function exportCommentsConfigurationSeedService({
  listing,
  comments,
}) {
  if (!listing) return null;
  const context = await getCommentSeedContextService({
    projectId: listing.projectId,
    scopeId: listing.scopeId,
  });
  const warnings = [];
  const seeds = (comments ?? []).map((comment) =>
    commentToSeed(comment, context, warnings)
  );
  return {
    listings: [
      {
        key: listing.key ?? toKey(listing.name),
        name: listing.name,
        comments: seeds,
      },
    ],
    warnings: [...new Set(warnings)],
  };
}
