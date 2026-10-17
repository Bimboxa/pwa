import { EDITOR_3D } from "../constants/commandEditors";
import { DRAW_IN_PROGRESS_REASON } from "./drawToolCommandState";

// 3D placement tools of the base maps (Features/threedBaseMapMove):
// « Déplacer » grabs a snapped point of a base map's content and the whole
// base map (image + annotations) follows the mouse; « Tourner » picks a pivot
// and rotates the base map around the world-vertical axis through it. Both
// are threedEditor mode toggles (the slice owns their mutual exclusion),
// offered in every editing module displaying the 3D editor (Dessin, Zones,
// business objects, Fonds de plan) — never in the read-only Viewer / Scope
// modules.
export default function createBaseMapPlacementCommand({
  key,
  label,
  Icon,
  getActive,
  setActive,
}) {
  return {
    key,
    label,
    Icon,
    editors: [EDITOR_3D],
    getState(ctx) {
      if (ctx.viewerKey === "THREED" || ctx.viewerKey === "SCOPE") {
        return { enabled: false, reason: "Module en lecture seule" };
      }
      if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
      if (ctx.enabledDrawingMode) {
        return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
      }
      return { enabled: true, active: Boolean(getActive(ctx)) };
    },
    run(ctx, { dispatch }) {
      dispatch(setActive(!getActive(ctx)));
    },
  };
}
