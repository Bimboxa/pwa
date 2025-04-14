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
      console.error("No result returned from Dropbox API");
      return null;
    }
  } catch (error) {
    console.error("Error getting folder metadata:", error);
    return null;
  }
}
