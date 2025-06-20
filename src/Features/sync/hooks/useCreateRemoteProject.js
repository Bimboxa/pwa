import useRemoteContainer from "./useRemoteContainer";
import useRemoteProvider from "./useRemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "../utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "../services/syncTaskLocalToRemote";

export default function useCreateRemoteProject() {
  // data

  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // main
  const createAsync = async (project) => {
    if (!remoteContainer) return;

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
