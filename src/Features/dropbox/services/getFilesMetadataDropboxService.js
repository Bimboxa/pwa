import {Dropbox} from "dropbox";
import dropboxToGenericMetadata from "../utils/dropboxToGenericMetadata";

export default async function getFilesMetadataDropboxService({
  path,
  accessToken,
}) {
  try {
    const dbx = new Dropbox({
      accessToken,
    });

    const listResult = await dbx.filesListFolder({path});

    const targetFiles = listResult.result.entries.filters(
      (entry) => entry[".tag"] === "file"
    );

    return dropboxToGenericMetadata(targetFiles);

    if (!listResult) {
      throw new Error("Files not found in folder.");
    }
  } catch (e) {
    console.error("Error fetching file:", e);
    throw new Error("Error fetching file from Dropbox.");
  }
}
