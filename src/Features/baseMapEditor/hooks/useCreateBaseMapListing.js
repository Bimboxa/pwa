import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

export default function useCreateBaseMapListing() {
  const appConfig = useAppConfig();

  const create = async ({ projectId, title, rank }) => {
    const entityModel = appConfig?.entityModelsObject?.baseMap;
    const listingId = nanoid();

    // Rank after the last existing baseMap listing of the project
    // (listings are ordered by rank — fractional indexing).
    let _rank = rank;
    if (_rank == null) {
      const projectListings = (
        await db.listings.where("projectId").equals(projectId).toArray()
      ).filter((l) => !l.deletedAt && l.entityModelKey === "baseMap");
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
      name: title || "Fonds de plan",
      rank: _rank,
      entityModelKey: "baseMap",
      entityModel,
      table: entityModel?.defaultTable || "baseMaps",
      canCreateItem: true,
    };

    await db.listings.add(listing);
    return listing;
  };

  return create;
}
