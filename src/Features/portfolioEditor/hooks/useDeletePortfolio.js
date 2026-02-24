import db from "App/db/db";

export default function useDeletePortfolio() {
  const deletePortfolio = async (portfolioId) => {
    const pages = await db.portfolioPages
      .where("portfolioId")
      .equals(portfolioId)
      .toArray();

    const containers = [];
    for (const page of pages) {
      const pageContainers = await db.portfolioBaseMapContainers
        .where("portfolioPageId")
        .equals(page.id)
        .toArray();
      containers.push(...pageContainers);
    }

    // Soft-delete containers, then pages, then portfolio
    for (const container of containers) {
      await db.portfolioBaseMapContainers.delete(container.id);
    }
    for (const page of pages) {
      await db.portfolioPages.delete(page.id);
    }
    await db.portfolios.delete(portfolioId);
  };

  return deletePortfolio;
}
