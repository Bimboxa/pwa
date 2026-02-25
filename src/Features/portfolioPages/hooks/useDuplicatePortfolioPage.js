import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

export default function useDuplicatePortfolioPage() {
  const duplicatePortfolioPage = async (page) => {
    const sortIndex = generateKeyBetween(page.sortIndex ?? null, null);

    const newPage = {
      id: nanoid(),
      portfolioId: page.portfolioId,
      scopeId: page.scopeId,
      projectId: page.projectId,
      title: page.title + " (copie)",
      sortIndex,
      format: page.format,
      orientation: page.orientation,
      type: page.type,
    };

    await db.portfolioPages.add(newPage);

    // duplicate all containers
    const containers = await db.portfolioBaseMapContainers
      .where("portfolioPageId")
      .equals(page.id)
      .toArray();

    for (const container of containers.filter((c) => !c.deletedAt)) {
      await db.portfolioBaseMapContainers.add({
        ...container,
        id: nanoid(),
        portfolioPageId: newPage.id,
      });
    }

    return newPage;
  };

  return duplicatePortfolioPage;
}
