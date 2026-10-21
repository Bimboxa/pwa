import IconCurvature from "Features/icons/IconCurvature";

import getContiguousPointRun from "Features/annotations/utils/getContiguousPointRun";
import { getContiguousSegmentChains } from "Features/annotations/utils/getContiguousSegmentChain";

import ButtonArcify from "./ButtonArcify";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// Why a sub-selection of the contour cannot be arc-ified, per selectedPart
// kind (see resolveSelectedAnnotationPart). Kinds absent here fall back to
// the whole-annotation mode.
const SUB_SELECTION_REASONS = {
  MIXED: "Sélectionnez au moins 3 points contigus d'un même contour",
  SEGMENTS: "Sélectionnez des segments contigus d'un même contour",
  SEGMENT: "Sélectionnez au moins 2 segments contigus",
  CUT_SEG: "Sélectionnez au moins 2 segments contigus",
};

// Point ids spanned by the sub-selection of the contour: the selected points
// plus the end points of the selected segments (main ring and cut rings).
// Contiguity / single-ring validation is left to getContiguousPointRun.
function getSubSelectionPointIds(annotation, part) {
  const ids = new Set();
  const addRefs = (refs) => refs?.forEach((p) => p?.id && ids.add(p.id));

  switch (part?.kind) {
    case "MIXED":
      part.pointIds?.forEach((id) => id && ids.add(id));
      // CUT / non-segment part ids are ignored by the chain decoder.
      getContiguousSegmentChains(annotation, part.partIds ?? []).forEach(
        (chain) => addRefs(chain.pointRefs)
      );
      break;
    case "SEGMENTS": // pointRefs is empty when the chains are not contiguous
    case "SEGMENT":
    case "CUT_SEG":
      addRefs(part.pointRefs);
      break;
    default:
      return [];
  }
  return [...ids];
}

// A sub-selection (points and / or segments of the contour) of a POLYLINE /
// POLYGON forming ≥ 3 contiguous points of one ring: « Simplifier en arc »
// replaces the run by an arc (useArcifySelectedPoints).
export function getArcifyPointsTarget(ctx) {
  const part = ctx.selectedPart;
  const a = ctx.selectedAnnotation;
  if (!a || !SUB_SELECTION_REASONS[part?.kind]) return null;
  if (!["POLYLINE", "POLYGON"].includes(a.type)) return null;
  const pointIds = getSubSelectionPointIds(a, part);
  if (!getContiguousPointRun(a, pointIds).valid) return null;
  return { annotation: a, pointIds };
}

// « Détecter les arcs » of the selected POLYLINE (useArcifyAnnotation) — or,
// with ≥ 3 contiguous points (or ≥ 2 contiguous segments) of the contour
// selected, « Simplifier en arc » on that run.
export default {
  key: "ARCIFY",
  label: "Détecter les arcs",
  Icon: IconCurvature,
  Button: ButtonArcify,
  getState(ctx) {
    if (getArcifyPointsTarget(ctx)) return { enabled: true };
    const reason = SUB_SELECTION_REASONS[ctx.selectedPart?.kind];
    if (reason) return { enabled: false, reason };
    return getSingleAnnotationState(ctx, ["POLYLINE"], "Réservé aux lignes");
  },
};
