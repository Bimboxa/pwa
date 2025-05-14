import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";

export default function useCreateRemoteListings() {
  // data

  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  // main
  const createAsync = async (listings) => {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer?.service,
    });

    for (let listing of listings) {
      const task = await createSyncTaskLocalToRemoteFromItem({
        item: listing,
        type: "LISTING",
      });
      console.log("[createRemoteScope] syncTaskLocalToRemote", task);
      await syncTaskLocalToRemote({task, remoteProvider});
    }
  };

  // return

  return createAsync;
}
