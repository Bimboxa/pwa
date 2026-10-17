import IconSlopeWall from "Features/annotations/components/IconSlopeWall";

import ButtonSlopeWalls from "./ButtonSlopeWalls";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Parois de la pente »: generates the vertical walls along the sloped edges
// of the selected POLYGON (DialogGenerateSlopeWalls) — needs a sloped guide
// line.
export default {
  key: "SLOPE_WALLS",
  label: "Parois de la pente",
  Icon: IconSlopeWall,
  Button: ButtonSlopeWalls,
  getState(ctx) {
    const state = getSingleAnnotationState(
      ctx,
      ["POLYGON"],
      "Réservé aux surfaces"
    );
    if (!state.enabled) return state;
    const sloped = ctx.selectedAnnotation.guideLines?.some(
      (g) => g?.points?.length >= 2 && g?.slopePct
    );
    return sloped
      ? { enabled: true }
      : { enabled: false, reason: "La surface n'a pas de ligne guide pentée" };
  },
};
