import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";
import useRemoteProvider from "./useRemoteProvider";

export default function useCreateRemoteScope() {
  // data

  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // main
  const createAsync = async (scope) => {
    if (!remoteContainer) return;

    const task = await createSyncTaskLocalToRemoteFromItem({
      item: scope,
      type: "SCOPE",
      remoteContainer,
    });
    console.log("[createRemoteScope] syncTaskLocalToRemote", task);
    await syncTaskLocalToRemote({task, remoteProvider});
  };

  // return

  return createAsync;
}
