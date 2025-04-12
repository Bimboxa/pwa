import useCreateRemoteFile from "Features/sync/hooks/useCreateRemoteFile";
import getScopeRemoteFile from "../utils/getScopeRemoteFile";

export default function useCreateRemoteScopeFile() {
  const createFile = useCreateRemoteFile();

  const create = async ({scope, remoteProjectContainer}) => {
    const file = getScopeRemoteFile(scope);
    const fileName = file.name;

    let path = null;
    if (remoteProjectContainer?.service === "DROPBOX") {
      const projectPath = remoteProjectContainer?.metadata?.path_display;
      path = `${projectPath}/_data/${fileName}`;
    }

    await createFile({path, blob: file});
  };

  return create;
}
