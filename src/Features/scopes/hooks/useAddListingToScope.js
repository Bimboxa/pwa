import useUpdateScope from "./useUpdateScope";

export default function useAddListingToScope() {
  const updateScope = useUpdateScope();

  const addListingToScope = async ({ listingId, listingTable, scope }) => {
    const updates = {
      id: scope.id,
      sortedListings: [
        ...scope.sortedListings,
        { id: listingId, table: listingTable },
      ],
    };
    await updateScope(updates, { updateSyncFile: true });
    return scope;
  };

  return addListingToScope;
}
