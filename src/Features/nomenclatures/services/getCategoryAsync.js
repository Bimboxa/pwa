import db from "App/db/db";
import getNodeById from "Features/tree/utils/getNodeById";

export default async function getCategoryAsync(categoryId, nomenclatureId) {
  const listing = await db.listings.get(nomenclatureId);
  const nomenclature = listing?.metadata?.nomenclature;
  return getNodeById(categoryId, nomenclature?.items);
}
