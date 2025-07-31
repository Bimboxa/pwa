import {
  red,
  green,
  blue,
  pink,
  purple,
  deepPurple,
  indigo,
  lightBlue,
  cyan,
  teal,
} from "@mui/material/colors";

export default function useMarkerTemplateByIndex() {
  const colors = [
    red[500],
    pink[500],
    purple[500],
    deepPurple[500],
    indigo[500],
    blue[500],
    lightBlue[500],
    cyan[500],
    teal[500],
    green[500],
  ];

  return colors.reduce((acc, color, index) => {
    acc[index] = {
      iconColor: color,
      iconIndex: index,
    };
    return acc;
  }, {});
}
