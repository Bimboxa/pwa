import { CallSplit } from "@mui/icons-material";

import isComponentTemplate from "Features/annotationComponents/utils/isComponentTemplate";

import ButtonExplodeComponent from "./ButtonExplodeComponent";
import { getSelectionGate } from "../../utils/selectionCommandState";

const NOT_A_COMPONENT_REASON = "Réservé aux composants";
const NO_ITEM_REASON = "Le composant n'a aucun élément actif";

// A component SOURCE (Features/annotationComponents): the drawn annotation of
// a COMPONENT template, stamped `componentApplied` by the sync.
function isComponentSource(annotation) {
  if (!annotation || annotation.componentSourceAnnotationId) return false;
  return (
    Boolean(annotation.componentApplied) ||
    isComponentTemplate(annotation.annotationTemplate)
  );
}

// The selected components that can be exploded (at least one generated
// annotation).
export function getExplodeComponentTargets(ctx) {
  return ctx.selectedAnnotations.filter(
    (a) => isComponentSource(a) && (a.componentApplied?.count ?? 0) > 0
  );
}

// « Éclater le composant »: replaces the selected components by their
// generated annotations, turned into regular, independent annotations
// (explodeComponentService) — the component itself is deleted. Only enabled
// on a component, so the context filter of the toolbar (« Masquer les
// commandes désactivées ») only shows it while a component is selected.
export default {
  key: "EXPLODE_COMPONENT",
  usesSelection: true,
  label: "Éclater le composant",
  Icon: CallSplit,
  Button: ButtonExplodeComponent,
  getState(ctx) {
    const gate = getSelectionGate(ctx);
    if (gate) return gate;
    const hasComponent =
      ctx.selectedAnnotations.some(isComponentSource) ||
      isComponentSource(ctx.selectedAnnotation);
    if (!hasComponent) {
      return { enabled: false, reason: NOT_A_COMPONENT_REASON };
    }
    if (getExplodeComponentTargets(ctx).length === 0) {
      return { enabled: false, reason: NO_ITEM_REASON };
    }
    return { enabled: true };
  },
};
