import db from "App/db/db";

export default async function deleteListingDataInDb(listingId) {
  const tables = ["entities", "files"];

  for (let tableName of tables) {
    const table = db[tableName];

    if (!table) continue;

    await table.where("listingId").equals(listingId).delete();
  }
}
