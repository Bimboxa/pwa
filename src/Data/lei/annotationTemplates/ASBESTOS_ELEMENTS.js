import { red } from "@mui/material/colors";

const ASBESTOS_ELEMENTS = {
  key: "ASBESTOS_ELEMENTS",
  name: "Ouvrages amiantés",
  iconKey: "shapes",
  color: red[700],
  keywords: ["type:repérage"],
  templates: [
    {
      label: "Murs",
      drawingShape: "POLYLINE",
      strokeColor: red[900],
      strokeType: "SOLID",
      strokeOpacity: 0.75,
      strokeWidth: 4,
      strokeWidthUnit: "PX",
      closeLine: false,
      mainQtyKey: "L",
      overrideFields: ["strokeColor", "strokeWidth", "strokeWidthUnit"],
    },
    ...[
      { label: "Sol", color: red[700] },
      { label: "Plafond", color: red[500] },
      { label: "Poteaux", color: red[300] },
    ].map(({ label, color }) => ({
      label,
      drawingShape: "POLYGON",
      fillColor: color,
      fillType: "SOLID",
      fillOpacity: 0.75,
      strokeColor: color,
      closeLine: true,
      mainQtyKey: "S",
      overrideFields: ["fillColor"],
    })),
  ],
};

export default ASBESTOS_ELEMENTS;
