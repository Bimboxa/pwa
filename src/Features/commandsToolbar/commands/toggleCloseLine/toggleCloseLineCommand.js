import { CloseFullscreen } from "@mui/icons-material";

import db from "App/db/db";

import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Fermer / Ouvrir la ligne »: toggles `closeLine` of the selected POLYLINE /
// STRIP (the band / stroke closes on its first point).
export default {
  key: "TOGGLE_CLOSE_LINE",
  label: "Fermer / Ouvrir la ligne",
  Icon: CloseFullscreen,
  getState(ctx) {
    const state = getSingleAnnotationState(
      ctx,
      ["POLYLINE", "STRIP"],
      "Réservé aux lignes et aux bandes"
    );
    if (!state.enabled) return state;
    return { enabled: true, active: Boolean(ctx.selectedAnnotation.closeLine) };
  },
  async run(ctx) {
    const a = ctx.selectedAnnotation;
    await db.annotations.update(a.id, { closeLine: !a.closeLine });
  },
};
