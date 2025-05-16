import {Dropbox} from "dropbox";

export default async function fetchDropboxSharedFileMetadataService({
  accessToken,
  link,
}) {
  const dbx = new Dropbox({accessToken});
  try {
    const response = await dbx.sharingGetSharedLinkMetadata({url: link});
    return response.result; // Contains name, path_lower, id, etc.
  } catch (err) {
    console.error("Error fetching shared link metadata:", err);
    return null;
  }
}
