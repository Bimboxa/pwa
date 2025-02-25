import store from "App/store";
import {gapiPromise} from "./gapiServices";

export const listFiles = async (folderId) => {
  try {
    const accessToken = store.getState().gapi.accessToken;
    const gapi = await gapiPromise;
    //
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents`,
      fields:
        "files(id, name, webViewLink, webContentLink, mimeType, thumbnailLink)",
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    const files = response.result.files;
    console.log("files", files);
    return files;
  } catch (e) {
    console.log(e);
  }
};
