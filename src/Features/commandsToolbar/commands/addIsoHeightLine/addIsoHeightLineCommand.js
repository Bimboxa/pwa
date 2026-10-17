import SsidChart from "@mui/icons-material/SsidChart";

import createPolygonLineCommand from "../../utils/createPolygonLineCommand";

// « Ajouter une courbe de niveau » (ADD_ISO_HEIGHT_LINE drawing mode) on the
// selected POLYGON.
export default createPolygonLineCommand({
  key: "ADD_ISO_HEIGHT_LINE",
  label: "Ajouter une courbe de niveau",
  Icon: SsidChart,
  drawingMode: "ADD_ISO_HEIGHT_LINE",
  types: ["POLYGON"],
  typesReason: "Réservé aux surfaces",
});
