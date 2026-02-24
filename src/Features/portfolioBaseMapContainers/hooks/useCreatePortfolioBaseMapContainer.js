import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

export default function useCreatePortfolioBaseMapContainer() {
  const create = async ({
    portfolioPageId,
    scopeId,
    projectId,
    baseMapId,
    x,
    y,
    width,
    height,
    afterSortIndex,
  }) => {
    const sortIndex = generateKeyBetween(afterSortIndex ?? null, null);

    const container = {
      id: nanoid(),
      portfolioPageId,
      scopeId,
      projectId,
      baseMapId: baseMapId || null,
      x: x || 0,
      y: y || 0,
      width: width || 600,
      height: height || 400,
      viewBox: null,
      sortIndex,
    };

    await db.portfolioBaseMapContainers.add(container);
    return container;
  };

  return create;
}
