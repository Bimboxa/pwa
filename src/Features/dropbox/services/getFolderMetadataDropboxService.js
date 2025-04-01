import {Dropbox} from "dropbox";

export default async function getFolderMetadata({path, accessToken}) {
  const dbx = new Dropbox({accessToken});
  try {
    const result = await dbx.filesGetMetadata({path});
    if (result.result[".tag"] === "folder") {
      console.log("Folder metadata:", result.result);
      return result.result;
    } else {
      throw new Error("The path is not a folder.");
    }
  } catch (error) {
    console.error("Error getting folder metadata:", error);
    throw error;
  }
}
