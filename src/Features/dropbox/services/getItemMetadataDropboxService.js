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
      console.log("No result returned from Dropbox API");
      return null;
    }
  } catch (err) {
    console.log("[debug] error", err);
    return null;
  }
}
