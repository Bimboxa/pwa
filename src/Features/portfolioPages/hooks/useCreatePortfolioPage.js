import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

export default function useCreatePortfolioPage() {
  const create = async ({
    portfolioId,
    scopeId,
    projectId,
    title,
    format,
    orientation,
    afterSortIndex,
  }) => {
    const sortIndex = generateKeyBetween(afterSortIndex ?? null, null);

    const page = {
      id: nanoid(),
      portfolioId,
      scopeId,
      projectId,
      title: title || "Nouvelle page",
      sortIndex,
      format: format || "A4",
      orientation: orientation || "landscape",
      type: "BASE_MAPS_PAGE",
    };

    await db.portfolioPages.add(page);
    return page;
  };

  return create;
}
