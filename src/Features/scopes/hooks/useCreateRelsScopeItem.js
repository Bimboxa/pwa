import {nanoid} from "@reduxjs/toolkit";

import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

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
      //
      const item = {scopeId: scope.id};
      await updateItemSyncFile({item, type: "RELS_SCOPE_ITEM"});
    } catch (error) {
      console.error("Error creating relsScopeItems:", error);
      throw error;
    }
  };

  return create;
}
