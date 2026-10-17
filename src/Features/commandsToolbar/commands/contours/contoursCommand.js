import IconContours from "Features/icons/IconContours";

import ButtonContours from "./ButtonContours";
import { getTargetsState } from "../../utils/selectionCommandState";

export const CONTOURS_TYPES = ["POLYLINE", "STRIP", "POLYGON"];

// « Contours »: creates the boundary lines / bands of the selected walls
// (POLYLINE / STRIP — useWallBoundaries) and surfaces (POLYGON —
// usePolygonContours) with a chosen polyline template.
export default {
  key: "CONTOURS",
  label: "Contours",
  Icon: IconContours,
  Button: ButtonContours,
  getState: (ctx) =>
    getTargetsState(
      ctx,
      CONTOURS_TYPES,
      "Sélectionnez au moins une ligne, bande ou surface"
    ),
};
