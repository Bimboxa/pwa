import initListingFolderDropboxService from "Features/dropbox/services/initListingFolderDropboxService";

export default function initRemoteListingContainerService({
  accessToken,
  name,
  serviceKey,
  remoteProjectContainerProps,
}) {
  if (serviceKey === "DROPBOX") {
    const dropboxPath =
      remoteProjectContainerProps?.dropboxFolder?.path_display;
    const parentPath = dropboxPath + "/Listings/" + name;
    return initListingFolderDropboxService({
      accessToken,
      name,
      parentPath,
    });
  }
}
