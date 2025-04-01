import {Dropbox} from "dropbox";

export default async function getRemoteProjectSyncDataDropboxService({
  remoteProjectFolderId,
  accessToken,
}) {
  try {
    const dbx = new Dropbox({
      accessToken,
    });

    const listResult = await dbx.filesListFolder({path: remoteProjectFolderId});

    const targetFile = listResult.result.entries.find(
      (entry) =>
        entry[".tag"] === "file" && entry.name === "remoteProjectSyncData.json"
    );

    if (!targetFile) {
      throw new Error("File remoteProjectSyncData.json not found in folder.");
    }
  } catch (e) {
    console.error("Error fetching file:", e);
    throw new Error("Error fetching file from Dropbox.");
  }
}
