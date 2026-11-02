import ShowChart from "@mui/icons-material/ShowChart";

import createPolygonLineCommand from "../../utils/createPolygonLineCommand";
import ButtonAddProfileLine from "./ButtonAddProfileLine";

// « Ajouter un profil » on the selected POLYGON / POLYLINE: the button opens
// a menu — draw the profile (ADD_PROFILE_LINE drawing mode, its vertical
// projection is then edited in the Élévation panel) or apply an existing
// annotation flagged « Profil » (POLYLINE hosts). `run` (hotkeys / shortcuts)
// keeps the plain drawing-mode toggle.
export default createPolygonLineCommand({
  key: "ADD_PROFILE_LINE",
  label: "Ajouter un profil",
  Icon: ShowChart,
  Button: ButtonAddProfileLine,
  drawingMode: "ADD_PROFILE_LINE",
  types: ["POLYGON", "POLYLINE"],
  typesReason: "Réservé aux surfaces et aux lignes",
});
