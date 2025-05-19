import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";

export default function useDeleteRemoteListing() {
  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  const {value: listing} = useSelectedListing();

  const deleteAsync = async () => {};

  return deleteAsync;
}
