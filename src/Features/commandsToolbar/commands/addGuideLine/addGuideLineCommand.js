import Timeline from "@mui/icons-material/Timeline";

import createPolygonLineCommand from "../../utils/createPolygonLineCommand";

// « Ajouter une ligne guide » (ADD_GUIDE_LINE drawing mode) on the selected
// POLYGON — the guide line carries the slope of the surface.
export default createPolygonLineCommand({
  key: "ADD_GUIDE_LINE",
  label: "Ajouter une ligne guide",
  Icon: Timeline,
  drawingMode: "ADD_GUIDE_LINE",
  types: ["POLYGON"],
  typesReason: "Réservé aux surfaces",
});
