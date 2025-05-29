import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useUpdateRemoteItem from "Features/sync/hooks/useUpdateRemoteItem";
import useSelectedListing from "./useSelectedListing";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

export default function useDeleteRemoteListing() {
  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  const {value: listing} = useSelectedListing();
  const {value: scope} = useSelectedScope();

  const updateRemoteItem = useUpdateRemoteItem();

  const deleteAsync = async () => {
    // edge case
    if (!listing) return;

    // scope
    if (scope) {
      const newSortedListings = scope.sortedListings.filter(
        (l) => l.id !== listing?.id
      );
      const updatedScope = {...scope, sortedListings: newSortedListings};
      await updateRemoteItem({item: updatedScope, type: "SCOPE"});
    }
  };

  return deleteAsync;
}
