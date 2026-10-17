import IconCurvature from "Features/icons/IconCurvature";

import getContiguousPointRun from "Features/annotations/utils/getContiguousPointRun";

import ButtonArcify from "./ButtonArcify";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// A MIXED sub-selection (points of the contour) of a POLYLINE / POLYGON:
// « Simplifier en arc » replaces the run by an arc (useArcifySelectedPoints).
export function getArcifyPointsTarget(ctx) {
  const part = ctx.selectedPart;
  const a = ctx.selectedAnnotation;
  if (!a || part?.kind !== "MIXED") return null;
  if (!["POLYLINE", "POLYGON"].includes(a.type)) return null;
  const pointIds = part.pointIds ?? [];
  if (!getContiguousPointRun(a, pointIds).valid) return null;
  return { annotation: a, pointIds };
}

// « Détecter les arcs » of the selected POLYLINE (useArcifyAnnotation) — or,
// with ≥ 3 contiguous points of the contour selected, « Simplifier en arc »
// on that run.
export default {
  key: "ARCIFY",
  label: "Détecter les arcs",
  Icon: IconCurvature,
  Button: ButtonArcify,
  getState(ctx) {
    if (getArcifyPointsTarget(ctx)) return { enabled: true };
    if (ctx.selectedPart?.kind === "MIXED") {
      return {
        enabled: false,
        reason: "Sélectionnez au moins 3 points contigus d'un même contour",
      };
    }
    return getSingleAnnotationState(ctx, ["POLYLINE"], "Réservé aux lignes");
  },
};
