import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import db from "App/db/db";

export default function useDuplicatePortfolioPage() {
  const createEntity = useCreateEntity();

  const duplicatePortfolioPage = async (page, listing) => {
    const sortIndex = generateKeyBetween(page.sortIndex ?? null, null);

    const pageData = {
      title: page.title + " (copie)",
      sortIndex,
      format: page.format,
      orientation: page.orientation,
      type: page.type,
    };

    const newPage = await createEntity(pageData, { listing });

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
