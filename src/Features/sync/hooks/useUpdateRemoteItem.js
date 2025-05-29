import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";
import useRemoteProvider from "./useRemoteProvider";

export default function useUpdateRemoteItem() {
  // data

  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // main
  const updateAsync = async ({item, type}) => {
    const task = await createSyncTaskLocalToRemoteFromItem({
      item,
      type,
      remoteContainer,
    });
    console.log("[createRemoteScope] syncTaskLocalToRemote", task);
    await syncTaskLocalToRemote({task, remoteProvider});
  };

  // return

  return updateAsync;
}
