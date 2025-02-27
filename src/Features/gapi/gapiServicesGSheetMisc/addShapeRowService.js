import {gapiPromise} from "../gapiServices";
import hexToRgb from "Features/colors/utils/hexToRgb";

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

  // Step 3: Extract row index from the response
  const updatedRange = appendResponse.result.updates.updatedRange; // Example: "Sheet1!A5:F5"
  const rowIndex = parseInt(updatedRange.match(/\d+/)[0], 10) - 1; // Convert to zero-based index

  // Step 4: Convert HEX color to Google Sheets RGB format
  const rgbColor = hexToRgb(color, {variant: "gapi"});

  // Step 5: Update the background color of the "label" column (Column B = index 1)
  const colorRequest = {
    spreadsheetId: gSheetId,
    resource: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetId, // Use dynamically fetched sheet ID
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 1, // Column B (zero-based index)
              endColumnIndex: 2,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: rgbColor,
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  };

  const colorResponse = await gapi.client.sheets.spreadsheets.batchUpdate(
    colorRequest
  );
  console.log("Cell color updated:", colorResponse);
}
