import { nanoid } from "nanoid";

import useLogoDefault from "./useLogoDefault";

import db from "App/db/db";

export default function useCreatePortfolio() {
  const logoDefault = useLogoDefault();

  const create = async ({ scopeId, projectId, title, sortIndex }) => {
    const portfolioId = nanoid();

    // Build default headerConfig with logo if available
    let headerConfig = null;
    if (logoDefault?.url) {
      try {
        const response = await fetch(logoDefault.url);
        const blob = await response.blob();
        const fileArrayBuffer = await blob.arrayBuffer();
        const fileName = `logo_${portfolioId}.png`;

        await db.files.put({
          fileName,
          srcFileName: "logo_default.png",
          fileMime: blob.type || "image/png",
          fileType: "IMAGE",
          fileArrayBuffer,
          projectId,
        });

        headerConfig = { logo: { fileName, isImage: true } };
      } catch {
        // Silently ignore — portfolio will have no default logo
      }
    }

    const portfolio = {
      id: portfolioId,
      scopeId,
      projectId,
      title: title || "Portfolio",
      sortIndex: sortIndex ?? null,
      headerConfig,
    };

    await db.portfolios.add(portfolio);
    return portfolio;
  };

  return create;
}
