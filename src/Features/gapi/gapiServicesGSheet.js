import store from "App/store";
import {gapiPromise} from "./gapiServices";

export async function batchUpdateGSheet({sheetId, requests}) {
  //
  console.log("[batchUpdateGSheet] sheetId", sheetId, requests);
  //
  const accessToken = store.getState().gapi.accessToken;
  const gapi = await gapiPromise;
  //
  const response = await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requests,
    //headers: {Authorization: `Bearer ${accessToken}`},
  });
}
