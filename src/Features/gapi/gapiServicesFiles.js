import store from "App/store";
import {gapiPromise} from "./gapiServices";

export const getFile = async (fileId) => {
  try {
    const accessToken = store.getState().gapi.accessToken;

    // Directly fetch the image blob using the access token
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const blob = await response.blob();
    return blob;
  } catch (e) {
    console.log(e);
  }
};

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

export const getMapsFolderService = async (folderId) => {
  const accessToken = store.getState().gapi.accessToken;
  const gapi = await gapiPromise;

  const response = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id, name)",
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  const folders = response.result.files;

  if (!folders || folders.length === 0) {
    console.log("No folders found in the specified folder.");
    return null;
  }

  const mapsFolder = folders.find((folder) => folder.name === "Fonds de plans");

  if (mapsFolder) {
    return mapsFolder;
  } else {
    console.log('Folder "Fonds de plans" not found.');
    return null;
  }
};

export const getQtyTakeoffFileService = async (folderId) => {
  const accessToken = store.getState().gapi.accessToken;
  const gapi = await gapiPromise;

  const response = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet'`,
    fields: "files(id, name)",
    headers: {Authorization: `Bearer ${accessToken}`},
  });

  const gSheets = response.result.files;

  if (!gSheets || gSheets.length === 0) {
    console.log("No gSheets found in the specified folder.");
    return null;
  }

  const qtyTakeoffFile = gSheets.find((file) => file.name === "Métré");

  if (qtyTakeoffFile) {
    return qtyTakeoffFile;
  } else {
    console.log('Spreadsheet "Métré" not found.');
    return null;
  }
};
