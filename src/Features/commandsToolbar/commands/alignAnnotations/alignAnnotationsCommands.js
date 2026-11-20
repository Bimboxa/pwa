import {
  ALIGN_MODES,
  ALIGN_TARGETS_REASON,
  MIN_ALIGN_TARGETS,
} from "Features/annotationAlign/constants/alignModes";
import { ALIGN_MODE_ICONS } from "Features/annotationAlign/constants/alignModeIcons";

import ButtonAlignAnnotations from "./ButtonAlignAnnotations";
import getAlignCommandTargets from "./getAlignCommandTargets";
import { getSelectionGate } from "../../utils/selectionCommandState";

const EDITOR_2D_REASON = "Disponible dans l'éditeur 2D";

function getState(ctx) {
  const gate = getSelectionGate(ctx, { min: MIN_ALIGN_TARGETS });
  if (gate) return gate;
  if (ctx.isThreedEditor) return { enabled: false, reason: EDITOR_2D_REASON };
  if (getAlignCommandTargets(ctx).length < MIN_ALIGN_TARGETS) {
    return { enabled: false, reason: ALIGN_TARGETS_REASON };
  }
  return { enabled: true };
}

// « Aligner / centrer » (PowerPoint-like): one command per align mode, its
// key being the mode. Each selected annotation is translated along one axis
// onto the bounding box of the selection (alignAnnotationsService) — one undo
// step. 2D editor only.
export default ALIGN_MODES.map(({ key, label }) => ({
  key,
  usesSelection: true,
  label,
  Icon: ALIGN_MODE_ICONS[key],
  Button: ButtonAlignAnnotations,
  getState,
}));
