import {nanoid} from "@reduxjs/toolkit";

import db from "App/db/db";

export default function useCreateRelsScopeItem() {
  const create = async ({scope, items, itemsTable}) => {
    const relsScopeItems = items.map((item) => ({
      id: nanoid(),
      scopeId: scope.id,
      itemId: item.id,
      itemTable: itemsTable,
    }));

    try {
      await db.relsScopeItem.bulkAdd(relsScopeItems);
    } catch (error) {
      console.error("Error creating relsScopeItems:", error);
      throw error;
    }
  };

  return create;
}
