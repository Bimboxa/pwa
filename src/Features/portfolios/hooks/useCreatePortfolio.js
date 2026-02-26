import { nanoid } from "nanoid";

import useLogoDefault from "./useLogoDefault";

import db from "App/db/db";

// Convert an image URL to a data URL for self-contained storage.
async function urlToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function useCreatePortfolio() {
  const logoDefault = useLogoDefault();

  const create = async ({ scopeId, projectId, title, sortIndex }) => {
    // Build default headerConfig with logo if available
    let headerConfig = null;
    if (logoDefault?.url) {
      try {
        const logoDataUrl = await urlToDataUrl(logoDefault.url);
        headerConfig = { logo: logoDataUrl };
      } catch {
        // Silently ignore — portfolio will have no default logo
      }
    }

    const portfolio = {
      id: nanoid(),
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
