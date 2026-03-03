import { nanoid } from "nanoid";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

export default function useCreateBaseMapListing() {
  const appConfig = useAppConfig();

  const create = async ({ projectId, title, sortIndex }) => {
    const entityModel = appConfig?.entityModelsObject?.baseMap;
    const listingId = nanoid();

    const listing = {
      id: listingId,
      projectId,
      name: title || "Fonds de plan",
      sortIndex: sortIndex ?? null,
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
