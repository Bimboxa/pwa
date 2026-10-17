import { ContentCopy } from "@mui/icons-material";

import getCloneAnnotationPartState from "Features/annotations/utils/getCloneAnnotationPartState";

import ButtonClone from "./ButtonClone";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// « Dupliquer »: one selected annotation → CloneAnnotationFlow (part-aware:
// segments / opening / guide sub-selection clone the part; a sloped POLYGON
// with contour segments offers the wall-piece chooser); several →
// MenuCloneAnnotations (target type + template, whole selection).
export default {
  key: "CLONE",
  label: "Dupliquer",
  Icon: ContentCopy,
  Button: ButtonClone,
  getState(ctx) {
    const gate = getSelectionGate(ctx);
    if (gate) return gate;
    if (getTargets(ctx).length === 0) {
      return { enabled: false, reason: "Indisponible sur une maille 3D" };
    }
    if (ctx.selectedAnnotations.length === 1) {
      const part = ctx.selectedPart?.kind === "POINT" ? null : ctx.selectedPart;
      const { disabled, tooltip } = getCloneAnnotationPartState(part);
      if (disabled) {
        return {
          enabled: false,
          reason:
            tooltip ??
            "La sélection en cours ne peut pas être dupliquée (annotation entière ou segments)",
        };
      }
    }
    return { enabled: true };
  },
};
