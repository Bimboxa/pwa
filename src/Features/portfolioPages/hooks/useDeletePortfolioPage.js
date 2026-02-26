import useDeleteEntity from "Features/entities/hooks/useDeleteEntity";

import db from "App/db/db";

export default function useDeletePortfolioPage() {
  const deleteEntity = useDeleteEntity();

  const deletePortfolioPage = async (pageId) => {
    // cascade: soft-delete containers first
    const containers = await db.portfolioBaseMapContainers
      .where("portfolioPageId")
      .equals(pageId)
      .toArray();

    for (const container of containers) {
      await db.portfolioBaseMapContainers.delete(container.id);
    }

    // delete the page entity via the entity hook
    const page = await db.portfolioPages.get(pageId);
    if (page) {
      await deleteEntity(page);
    }
  };

  return deletePortfolioPage;
}
