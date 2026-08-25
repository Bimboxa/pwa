import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

// Creates a PHOTO album listing. Project-level on purpose: NO scopeId, so the
// album is shared across every scope of the project (same rule as baseMaps
// listings — see useCreateBaseMapListing).
export default function useCreatePhotoAlbum() {
  const appConfig = useAppConfig();

  const create = async ({ projectId, name, rank }) => {
    const entityModel = appConfig?.entityModelsObject?.photo;
    const listingId = nanoid();

    // Rank after the last existing photo listing of the project
    // (listings are ordered by rank — fractional indexing).
    let _rank = rank;
    if (_rank == null) {
      const projectListings = (
        await db.listings.where("projectId").equals(projectId).toArray()
      ).filter((l) => !l.deletedAt && l.entityModelKey === "photo");
      const lastRank = projectListings
        .map((l) => l.rank)
        .filter((r) => r != null)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .pop();
      _rank = generateKeyBetween(lastRank ?? null, null);
    }

    const listing = {
      id: listingId,
      projectId,
      name: name || "Photos",
      rank: _rank,
      entityModelKey: "photo",
      entityModel,
      table: entityModel?.defaultTable || "photos",
      canCreateItem: true,
    };

    await db.listings.add(listing);
    return listing;
  };

  return create;
}
