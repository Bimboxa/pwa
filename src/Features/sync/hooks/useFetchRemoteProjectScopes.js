import useRemoteContainer from "./useRemoteContainer";
import useRemoteToken from "./useRemoteToken";

import downloadZipFolderDropboxService from "Features/dropbox/services/downloadZipFolderDropboxService";
import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default function useFetchRemoteProjectScopes() {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // main

  const fetchRemoteProjectScopes = async ({project}) => {
    if (!remoteContainer) {
      console.log("No remote container available");
      return null;
    }

    if (!project) {
      console.log("[FETCH] no project");
      return null;
    }

    const {service} = remoteContainer;

    switch (service) {
      case "DROPBOX":
        const path =
          remoteContainer.projectsPath + "/" + project.clientRef + "/_data";
        console.log("[debug] download path", path);
        const zipBlob = await downloadZipFolderDropboxService({
          accessToken,
          path,
        });
        const files = await unzipFilesAsync(zipBlob);
        console.log("[debug] files", files);
        const scopesFiles = files?.filter((file) =>
          file.name.startsWith("_scope_")
        );
        const scopes = await Promise.all(
          scopesFiles?.map(async (file) => {
            const object = await jsonFileToObjectAsync(file);
            return object.data;
          })
        );
        return scopes;

      default:
        throw new Error(`Unknown service: ${service}`);
    }
  };

  // return

  return fetchRemoteProjectScopes;
}
