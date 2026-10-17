import ShowChart from "@mui/icons-material/ShowChart";

import createPolygonLineCommand from "../../utils/createPolygonLineCommand";

// « Ajouter un profil » (ADD_PROFILE_LINE drawing mode) on the selected
// POLYGON / POLYLINE — its vertical projection is then edited in the
// Élévation panel.
export default createPolygonLineCommand({
  key: "ADD_PROFILE_LINE",
  label: "Ajouter un profil",
  Icon: ShowChart,
  drawingMode: "ADD_PROFILE_LINE",
  types: ["POLYGON", "POLYLINE"],
  typesReason: "Réservé aux surfaces et aux lignes",
});
