import {Dropbox} from "dropbox";

export default async function getItemMetadataDropboxService({
  path,
  accessToken,
}) {
  const dbx = new Dropbox({accessToken});
  try {
    const result = await dbx.filesGetMetadata({path});
    if (result) {
      return result.result;
    } else {
      throw new Error("The path is not a folder/file.");
    }
  } catch (error) {
    console.error("Error getting folder metadata:", error);
    throw error;
  }
}
