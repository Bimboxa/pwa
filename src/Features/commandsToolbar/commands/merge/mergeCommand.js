import { CallMerge } from "@mui/icons-material";

import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

import ButtonMerge from "./ButtonMerge";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// Merge target of the selection: two or more annotations of one template and
// one drawing shape (POLYLINE or POLYGON), or null.
export function getMergeTarget(ctx) {
  const annotations = getTargets(ctx);
  if (annotations.length < 2) return null;
  const templateIds = new Set(
    annotations.map((a) => a.annotationTemplateId).filter(Boolean)
  );
  if (templateIds.size !== 1) return null;
  const shapes = new Set(
    annotations.map((a) => resolveDrawingShapeFromType(a.type))
  );
  if (shapes.size !== 1) return null;
  const shape = [...shapes][0];
  if (shape !== "POLYLINE" && shape !== "POLYGON") return null;
  return { shape, annotations };
}

// « Fusionner les annotations »: merges the selected annotations (same
// template, same shape — lines or surfaces) into one (useMergeAnnotations).
export default {
  key: "MERGE",
  label: "Fusionner les annotations",
  Icon: CallMerge,
  Button: ButtonMerge,
  getState(ctx) {
    const gate = getSelectionGate(ctx, { min: 2 });
    if (gate) return gate;
    if (!getMergeTarget(ctx)) {
      return {
        enabled: false,
        reason:
          "Sélectionnez au moins deux lignes (ou deux surfaces) du même modèle",
      };
    }
    return { enabled: true };
  },
};
