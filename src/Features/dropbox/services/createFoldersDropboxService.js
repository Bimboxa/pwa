import {Dropbox} from "dropbox";

export default async function createFoldersDropboxService({
  accessToken,
  pathList,
}) {
  try {
    const dbx = new Dropbox({accessToken});

    const remoteFolders = [];

    for (const path of pathList) {
      const response = await dbx.filesCreateFolderV2({path});
      const folder = response.result.metadata;
      remoteFolders.push(folder);
    }

    console.log("Created folders in Dropbox:", remoteFolders);

    return remoteFolders;
  } catch (error) {
    console.error("Error creating folders in Dropbox:", error);
  }
}
