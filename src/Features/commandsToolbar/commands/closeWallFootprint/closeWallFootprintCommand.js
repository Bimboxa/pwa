import IconCloseWallFootprint from "Features/annotations/components/IconCloseWallFootprint";

import ButtonCloseWallFootprint from "./ButtonCloseWallFootprint";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Retirer l'empreinte des murs »: removes the wall footprint (given
// thickness) from the selected POLYGON contour and cuts
// (removeWallFootprint), popover with the thickness field.
export default {
  key: "CLOSE_WALL_FOOTPRINT",
  label: "Retirer l'empreinte des murs",
  Icon: IconCloseWallFootprint,
  Button: ButtonCloseWallFootprint,
  getState: (ctx) =>
    getSingleAnnotationState(ctx, ["POLYGON"], "Réservé aux surfaces"),
};
