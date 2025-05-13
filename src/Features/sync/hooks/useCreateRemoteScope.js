import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";

export default function useCreateRemoteScope() {
  // data

  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  // main
  const createAsync = async (scope) => {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer?.service,
    });

    const task = await createSyncTaskLocalToRemoteFromItem({
      item: scope,
      type: "SCOPE",
    });
    console.log("[createRemoteScope] syncTaskLocalToRemote", task);
    await syncTaskLocalToRemote({task, remoteProvider});
  };

  // return

  return createAsync;
}
