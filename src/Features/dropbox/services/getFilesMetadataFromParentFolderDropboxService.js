import {Dropbox} from "dropbox";
import dropboxToGenericMetadata from "../utils/dropboxToGenericMetadata";

export default async function getFilesMetadataFromParentFolderDropboxService({
  path,
  accessToken,
}) {
  try {
    const dbx = new Dropbox({
      accessToken,
    });

    const listResult = await dbx.filesListFolder({path});

    if (!listResult) {
      throw new Error("Empty folder");
    }

    const targetFolders = listResult.result.entries.filter(
      (entry) => entry[".tag"] === "folder"
    );

    const targetFiles = [];

    for (const targetFolder in targetFolders) {
      const folderPath = targetFolder.path_display;
      const filesResult = await dbx.filesListFolder(folderPath);
      filesResult.result.entries.forEach((entry) => targetFiles.push(entry));
    }
    return targetFiles;
  } catch (e) {
    console.error("Error fetching file:", e);
    throw new Error("Error fetching file from Dropbox.");
  }
}
