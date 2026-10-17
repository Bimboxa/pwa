import { SwapHoriz } from "@mui/icons-material";

import db from "App/db/db";

import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Inverser le sens de l'extrusion »: flips `extrusionOrientation` (±1) of a
// profile-swept annotation (`shape3D.key === "EXTRUSION_PROFILE"`) — mirrors
// the profile to the other side of the contour (3D) and switches the offset
// preview side (2D, NodePolylineStatic).
export default {
  key: "FLIP_EXTRUSION",
  label: "Inverser le sens de l'extrusion",
  Icon: SwapHoriz,
  getState(ctx) {
    const state = getSingleAnnotationState(ctx);
    if (!state.enabled) return state;
    if (ctx.selectedAnnotation.shape3D?.key !== "EXTRUSION_PROFILE") {
      return {
        enabled: false,
        reason: "Réservé aux annotations extrudées le long d'un profil",
      };
    }
    return { enabled: true };
  },
  async run(ctx) {
    const a = ctx.selectedAnnotation;
    await db.annotations.update(a.id, {
      extrusionOrientation: (a.extrusionOrientation ?? 1) * -1,
    });
  },
};
