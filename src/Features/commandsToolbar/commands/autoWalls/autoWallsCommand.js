import ButtonAutoWalls from "./ButtonAutoWalls";
import IconAutoWalls from "./IconAutoWalls";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Parois auto »: creates the vertical walls connecting the selected
// POLYGON / POLYLINE to its adjacent surfaces (DialogAutoWalls).
export default {
  key: "AUTO_WALLS",
  label: "Parois auto",
  Icon: IconAutoWalls,
  Button: ButtonAutoWalls,
  getState: (ctx) =>
    getSingleAnnotationState(
      ctx,
      ["POLYGON", "POLYLINE"],
      "Réservé aux surfaces et aux lignes"
    ),
};
