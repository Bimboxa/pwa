import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";

export default function useCreateRemoteProject() {
  // data

  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  // main
  const createAsync = async (project) => {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer?.service,
    });

    const task = await createSyncTaskLocalToRemoteFromItem({
      item: project,
      type: "PROJECT",
      remoteContainer,
    });
    await syncTaskLocalToRemote({task, remoteProvider});
  };

  // return

  return createAsync;
}
