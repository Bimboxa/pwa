import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import getPageDimensions from "Features/portfolioEditor/utils/getPageDimensions";

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
    const _format = format || "A4";
    const _orientation = orientation || "landscape";

    const page = {
      id: nanoid(),
      portfolioId,
      scopeId,
      projectId,
      title: title || "Nouvelle page",
      sortIndex,
      format: _format,
      orientation: _orientation,
      type: "BASE_MAPS_PAGE",
    };

    await db.portfolioPages.add(page);

    // auto-create one empty container filling the page
    const dims = getPageDimensions(_format, _orientation);
    const margin = 20;
    const container = {
      id: nanoid(),
      portfolioPageId: page.id,
      scopeId,
      projectId,
      baseMapId: null,
      x: margin,
      y: margin,
      width: dims.width - margin * 2,
      height: dims.height - margin * 2,
      viewBox: null,
      sortIndex: generateKeyBetween(null, null),
    };
    await db.portfolioBaseMapContainers.add(container);

    return page;
  };

  return create;
}
