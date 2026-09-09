import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Dexie table holding the ITEMS of a listing, by entityModel type. Not
// listing.table / entityModel.defaultTable: an annotation listing declares
// `entities` there — the legacy entity-first flow — while its annotations
// live in db.annotations. Every table below indexes listingId.
const TABLE_BY_ENTITY_MODEL_TYPE = {
  BASE_MAP: "baseMaps",
  LOCATED_ENTITY: "annotations",
  BUSINESS_OBJECT: "businessObjects",
  PHOTO: "photos",
  ZONING: "zones",
  ZONE_ENTITY: "zones",
  ANNOTATION_TEMPLATE: "annotationTemplates",
  PORTFOLIO_PAGE: "portfolioPages",
  BLUEPRINT: "blueprints",
};

const EMPTY = {};

// {listingId: number of items} for the given listings — the count shown at the
// end of a listing row. One indexed pass per table (streamed with `each`, so a
// listing with thousands of annotations does not materialize them), and
// soft-deleted rows are skipped.
export default function useListingItemsCountById(listings) {
  const idsKey = (listings ?? [])
    .map((l) => `${l.id}:${l?.entityModel?.type}`)
    .join(",");

  const countById = useLiveQuery(async () => {
    if (!listings?.length) return EMPTY;

    // table -> the listing ids to count in it
    const idsByTable = {};
    listings.forEach((listing) => {
      const table = TABLE_BY_ENTITY_MODEL_TYPE[listing?.entityModel?.type];
      if (!table || !db[table]) return;
      if (!idsByTable[table]) idsByTable[table] = [];
      idsByTable[table].push(listing.id);
    });

    const counts = {};
    await Promise.all(
      Object.entries(idsByTable).map(async ([table, ids]) => {
        ids.forEach((id) => {
          counts[id] = 0;
        });
        await db[table]
          .where("listingId")
          .anyOf(ids)
          .each((row) => {
            if (row?.deletedAt) return;
            counts[row.listingId] = (counts[row.listingId] ?? 0) + 1;
          });
      })
    );
    return counts;
  }, [idsKey]);

  return countById ?? EMPTY;
}
