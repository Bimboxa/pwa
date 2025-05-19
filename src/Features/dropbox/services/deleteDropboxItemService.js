import {Dropbox} from "dropbox";

export default async function deleteDropboxItemService({path, accessToken}) {
  // Initialize Dropbox instance
  const dbx = new Dropbox({accessToken});
  try {
    const response = await dbx.filesDeleteV2({path});
    console.log("Deleted:", response);
  } catch (error) {
    console.error("Error deleting folder:", error);
  }
}
