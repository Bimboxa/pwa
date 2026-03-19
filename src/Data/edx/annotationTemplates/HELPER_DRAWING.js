import { pink, grey, red } from "@mui/material/colors";

const HELPER_DRAWING = {
  key: "HELPER_DRAWING",
  name: "Aide au dessin",
  iconKey: "shapes",
  color: pink[300],
  keywords: ["type:repérage", "secteur:cuvelage"],
  templates: [
    {
      label: "Fermeture pièce",
      drawingShape: "POLYLINE",
      strokeColor: pink[300],
      strokeWidth: 2,
      strokeWidthUnit: "PX",
    },
    {
      label: "Mur ép. 20cm",
      drawingShape: "POLYLINE",
      strokeColor: grey[500],
      strokeOpacity: 0.6,
      strokeWidth: 20,
      strokeWidthUnit: "CM",
      defaultTool: "STRIP",
      mainQtyKey: "L",
    },
    {
      label: "Mur",
      drawingShape: "POLYLINE",
      strokeColor: grey[300],
      strokeOpacity: 0.6,
      strokeWidth: 10,
      strokeWidthUnit: "CM",
      defaultTool: "STRIP",
      mainQtyKey: "L",
    },
    {
      label: "Parement voiles CT",
      drawingShape: "POLYLINE",
      strokeColor: red[500],
      strokeOpacity: 0.9,
      strokeWidth: 4,
      strokeWidthUnit: "PX",
      mainQtyKey: "L",
    },
  ],
};

export default HELPER_DRAWING;
