export default function computeSyncFileGetItemsRules({syncFileType}) {
  // helpers

  const rulesByType = {
    PROJECT: {
      getItemFromKey: "clientRef",
    },
    SCOPE: {
      getItemFromKey: "id",
    },
    LISTING: {
      getItemFromKey: "id",
    },
    ENTITIES: {
      getItemsFromKeys: ["listingId", "createdBy"], // based on key = [listingId+createdBy]
    },
    FILE: {
      getItemFromKey: "fileName",
    },
  };

  // result

  return rulesByType[syncFileType];
}
