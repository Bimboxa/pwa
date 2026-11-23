import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import { withSeedBlockIds } from "../utils/commentSeedRefs";

import bindSeededCommentsService from "./bindSeededCommentsService";
import createCommentListingService from "./createCommentListingService";

// Creates the info listings a Krto configuration declares, with their infos
// (`configuration.comments`):
//   comments: { listings: [{ key, name, comments: [seed, …] }] }
// Each seed references its listings / annotation templates / base maps by
// key (format: utils/commentSeedRefs.js — the « Copier comme modèle de
// configuration » action of the Infos panel produces it from a scope).
//
// The comments are written with their seed (`seedRefs`) and bound right away
// to what the scope already holds; the keys of pages created later stay
// pending (bindSeededCommentsService).
//
// Returns the created listings.
export default async function seedConfigurationCommentsService({
  configuration,
  projectId,
  scopeId,
  appConfig,
} = {}) {
  const listingConfigs = (configuration?.comments?.listings ?? []).filter(
    (listingConfig) => listingConfig?.comments?.length > 0
  );
  if (!projectId || !scopeId || !listingConfigs.length) return [];

  const listings = [];
  const comments = [];
  for (const listingConfig of listingConfigs) {
    const listing = await createCommentListingService({
      projectId,
      scopeId,
      name: listingConfig.name,
      key: listingConfig.key,
      appConfig,
    });
    if (!listing) continue;
    listings.push(listing);

    let sortIndex = null;
    for (const seed of listingConfig.comments) {
      sortIndex = generateKeyBetween(sortIndex, null);
      comments.push({
        id: nanoid(),
        projectId,
        scopeId,
        listingId: listing.id,
        title: seed.title ?? "",
        sortIndex,
        blocks: [],
        location: null,
        viewContext: null,
        seedRefs: { ...withSeedBlockIds(seed), pending: true },
      });
    }
  }

  if (comments.length) {
    await db.comments.bulkAdd(comments);
    await bindSeededCommentsService({ projectId, scopeId });
  }

  return listings;
}
