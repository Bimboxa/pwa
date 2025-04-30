import db from "App/db/db";

export default async function getListingItemsWithComputedFields({
  listing,
  computedFields,
}) {
  // helpers

  const listingId = listing.id;
  const table = listing.table;
  const entityModel = listing.entityModel;
  const listingItemsType = entityModel.type;

  const customFields = {}; // TO CHANGE

  // helpers

  const getItemsFrom = "NOMENCLATURE"; // "NOMENCLATURE" / "ITEMS_TABLE"

  // main - items

  let items = [];
  switch (getItemsFrom) {
    case "NOMENCLATURE": {
      const nomenclature = await db[table].where("listingId").equals(listingId);
      items = nomenclature?.tree;
    }
    case "ITEMS_TABLE": {
      items = await db[table].where("listingId").equals(listingId);
    }
  }

  // main - compute listing items needed for the rest of the computations.

  let relatedListingsItems = {};
  // {listingId:{listing,computedFields:[],items}}

  Object.entries(computedFields).forEach(([computedFields, rules]) => {});

  // main - compute fields

  Object.entries(computedFields).forEach(([computedField, rule]) => {
    if (rule.computationType === "HARD_CODED") {
      const scriptKey = rule.scriptKey;
    }
  });
}
