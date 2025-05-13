import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";

export default function useCreateRemoteProject() {
  // data

  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  // helper

  const remoteProvider = new RemoteProvider({
    accessToken,
    provider: remoteContainer.service,
  });

  // main
  const createAsync = async (project) => {
    const task = await createSyncTaskLocalToRemoteFromItem({
      item: project,
      type: "PROJECT",
    });
    await syncTaskLocalToRemote({task, remoteProvider});
  };

  // return

  return createAsync;
}
