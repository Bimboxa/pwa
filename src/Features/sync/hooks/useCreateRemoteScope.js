import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";

export default function useCreateRemoteScope() {
  // data

  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  // helper

  const remoteProvider = new RemoteProvider({
    accessToken,
    provider: remoteContainer.service,
  });

  // main
  const createAsync = async (scope) => {
    const task = await createSyncTaskLocalToRemoteFromItem({
      item: project,
      type: "SCOPE",
    });
    await syncTaskLocalToRemote({task, remoteProvider});
  };

  // return

  return createAsync;
}
