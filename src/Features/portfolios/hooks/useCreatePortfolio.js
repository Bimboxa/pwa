import { nanoid } from "nanoid";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

export default function useCreatePortfolio() {
  const appConfig = useAppConfig();

  const create = async ({ scopeId, projectId, title, sortIndex }) => {
    const entityModel = appConfig?.entityModelsObject?.portfolioPage;

    const listing = {
      id: nanoid(),
      scopeId,
      projectId,
      name: title || "Portfolio",
      sortIndex: sortIndex ?? null,
      entityModelKey: "portfolioPage",
      entityModel,
      table: entityModel?.defaultTable || "portfolioPages",
      metadata: null,
    };

    await db.listings.add(listing);
    return listing;
  };

  return create;
}
