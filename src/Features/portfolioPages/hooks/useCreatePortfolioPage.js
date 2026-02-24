import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import getPageDimensions from "Features/portfolioEditor/utils/getPageDimensions";
import computeContentArea from "Features/portfolioEditor/utils/computeContentArea";

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

    // auto-create one empty container filling the content area (below header)
    const dims = getPageDimensions(_format, _orientation);
    const contentArea = computeContentArea(dims);
    const container = {
      id: nanoid(),
      portfolioPageId: page.id,
      scopeId,
      projectId,
      baseMapId: null,
      x: contentArea.x,
      y: contentArea.y,
      width: contentArea.width,
      height: contentArea.height,
      viewBox: null,
      sortIndex: generateKeyBetween(null, null),
    };
    await db.portfolioBaseMapContainers.add(container);

    return page;
  };

  return create;
}
