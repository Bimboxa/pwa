import db from "App/db/db";

// Inserts the rows built by buildPromptIaBusinessObjectRows in ONE
// transaction. The caller dispatches the redux tick once afterwards.
export default async function createBusinessObjectsFromPromptIaService({
  rows,
}) {
  if (!rows?.length) return 0;
  await db.transaction("rw", db.businessObjects, async () => {
    await db.businessObjects.bulkAdd(rows);
  });
  return rows.length;
}
