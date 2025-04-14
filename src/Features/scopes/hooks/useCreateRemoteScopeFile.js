import useCreateRemoteFile from "Features/sync/hooks/useCreateRemoteFile";
import getScopeRemoteFile from "../utils/getScopeRemoteFile";
import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

export default function useCreateRemoteScopeFile() {
  const createFile = useCreateRemoteFile();
  const remoteContainer = useRemoteContainer();

  const create = async ({project, scope}) => {
    const remoteProjectContainerPath =
      remoteContainer.projectsPath + "/" + project.clientRef;
    const path = getRemoteItemPath({
      type: "SCOPE",
      remoteContainer,
      item: scope,
      options: {remoteProjectContainerPath},
    });

    const file = getScopeRemoteFile(scope);

    await createFile({path, blob: file});
  };

  return create;
}
