import { ContentCopy } from "@mui/icons-material";

import getCloneAnnotationPartState from "Features/annotations/utils/getCloneAnnotationPartState";

import ButtonClone from "./ButtonClone";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// « Dupliquer »: one selected annotation → CloneAnnotationFlow (part-aware:
// segments / opening / guide sub-selection clone the part; a sloped POLYGON
// with contour segments offers the wall-piece chooser; faces / edges selected
// in 3D — `ctx.mesh3dParts`, mesh annotations included — are cloned as
// surfaces (one per face) or lines (one per edge, or the closed contour of
// each face), see useCloneAnnotation3d); several →
// MenuCloneAnnotations (target type + template, whole selection).
export default {
  key: "CLONE",
  usesSelection: true,
  label: "Dupliquer",
  Icon: ContentCopy,
  Button: ButtonClone,
  getState(ctx) {
    const gate = getSelectionGate(ctx);
    if (gate) return gate;
    if (getTargets(ctx).length === 0 && !ctx.mesh3dParts) {
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
