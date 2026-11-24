import IconSimplify from "Features/annotations/components/IconSimplify";

import ButtonSimplify from "./ButtonSimplify";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Simplifier la géométrie » of the selected POLYLINE / POLYGON / STRIP:
// polynomial reduction (turf.simplify), outer contour (buffer in / out) and
// / or right angles (fitRightAnglePolygon), options kept in smartDetectSlice.
export default {
  key: "SIMPLIFY",
  usesSelection: true,
  label: "Simplifier la géométrie",
  Icon: IconSimplify,
  Button: ButtonSimplify,
  getState: (ctx) =>
    getSingleAnnotationState(
      ctx,
      ["POLYLINE", "POLYGON", "STRIP"],
      "Réservé aux lignes, surfaces et bandes"
    ),
};
