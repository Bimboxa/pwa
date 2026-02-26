import { nanoid } from "nanoid";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useLogoDefault from "./useLogoDefault";

import db from "App/db/db";

export default function useCreatePortfolio() {
  const appConfig = useAppConfig();
  const logoDefault = useLogoDefault();

  const create = async ({ scopeId, projectId, title, sortIndex }) => {
    const entityModel = appConfig?.entityModelsObject?.portfolioPage;
    const listingId = nanoid();

    // store default logo in db.files if available
    let metadata = null;
    if (logoDefault?.url) {
      try {
        const response = await fetch(logoDefault.url);
        const blob = await response.blob();
        const fileArrayBuffer = await blob.arrayBuffer();
        const fileName = `logo_${listingId}.png`;

        await db.files.put({
          fileName,
          srcFileName: "logo_default.png",
          fileMime: blob.type || "image/png",
          fileType: "IMAGE",
          fileArrayBuffer,
          projectId,
          listingId,
        });

        metadata = { logo: { fileName, isImage: true } };
      } catch {
        // Silently ignore — portfolio will have no default logo
      }
    }

    const listing = {
      id: listingId,
      scopeId,
      projectId,
      name: title || "Portfolio",
      sortIndex: sortIndex ?? null,
      entityModelKey: "portfolioPage",
      entityModel,
      table: entityModel?.defaultTable || "portfolioPages",
      metadata,
    };

    await db.listings.add(listing);
    return listing;
  };

  return create;
}
