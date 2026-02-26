import db from "App/db/db";

export default function useDeletePortfolio() {
  const deletePortfolio = async (portfolioId) => {
    const pages = await db.portfolioPages
      .where("listingId")
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

    // Soft-delete containers, then pages, then listing
    for (const container of containers) {
      await db.portfolioBaseMapContainers.delete(container.id);
    }
    for (const page of pages) {
      await db.portfolioPages.delete(page.id);
    }

    // Delete logo file(s) if any
    const listing = await db.listings.get(portfolioId);
    if (listing?.metadata?.logo?.fileName) {
      await db.files.delete(listing.metadata.logo.fileName);
    }

    await db.listings.delete(portfolioId);
  };

  return deletePortfolio;
}
