import {gapiPromise} from "../gapiServices";

export default async function addShapeRowService(shape, gSheetId) {
  const gapi = await gapiPromise;

  // helper

  const {id, points, label, height, color, selected, length, surface, volume} =
    shape;

  const row = [id, label, height, length, surface, volume];

  // Step 1: Get the first sheet's name and ID
  const sheetMetadata = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: gSheetId,
  });

  const firstSheet = sheetMetadata.result.sheets[0];
  const sheetId = firstSheet.properties.sheetId; // Numeric ID
  const sheetName = firstSheet.properties.title; // Name of the first sheet

  console.log(`First sheet found: Name=${sheetName}, ID=${sheetId}`);

  // Step 2: Append the row to the first sheet
  const appendResponse = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: gSheetId,
    range: `${sheetName}!A:A`, // Append to first available row
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [row],
    },
  });
}
