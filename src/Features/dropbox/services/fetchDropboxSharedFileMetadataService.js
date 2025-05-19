import {Dropbox} from "dropbox";

export default async function fetchDropboxSharedFileMetadataService({
  accessToken,
  link,
}) {
  const dbx = new Dropbox({accessToken});
  try {
    const response = await dbx.sharingGetSharedLinkMetadata({url: link});
    const result = response.result;
    console.log("[fetchSharedFileMetadata] debug_1905", result);
    return result; // Contains name, path_lower, id, etc.
  } catch (err) {
    console.error("debug_1905 Error fetching shared link metadata:", err);
    return null;
  }
}
