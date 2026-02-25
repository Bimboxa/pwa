import db from "App/db/db";

export default function useDeletePortfolioPage() {
  const deletePortfolioPage = async (pageId) => {
    // cascade: soft-delete containers first, then page
    const containers = await db.portfolioBaseMapContainers
      .where("portfolioPageId")
      .equals(pageId)
      .toArray();

    for (const container of containers) {
      await db.portfolioBaseMapContainers.delete(container.id);
    }
    await db.portfolioPages.delete(pageId);
  };

  return deletePortfolioPage;
}
