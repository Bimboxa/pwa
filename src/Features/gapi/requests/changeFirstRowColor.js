import hexToRgb from "Features/colors/utils/hexToRgb";
import theme from "Styles/theme";

export default function changeFirstRowColor(color) {
  // color
  if (!color) color = hexToRgb(theme.palette.shape.default);
  const [r, g, b] = color;

  // requests
  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: 0, // Change this if your sheet has multiple tabs
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: {
              red: 1,
              green: 1,
              blue: 0, // Yellow color
            },
          },
        },
        fields: "userEnteredFormat.backgroundColor",
      },
    },
  ];

  // return

  return requests;
}
