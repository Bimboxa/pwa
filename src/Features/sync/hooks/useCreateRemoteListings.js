import useRemoteProvider from "./useRemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";

export default function useCreateRemoteListings() {
  // data

  const remoteProvider = useRemoteProvider();

  // main
  const createAsync = async (listings) => {
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
