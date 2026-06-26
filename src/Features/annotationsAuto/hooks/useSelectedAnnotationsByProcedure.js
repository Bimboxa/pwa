import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationTemplatesByProject from "Features/annotations/hooks/useAnnotationTemplatesByProject";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

/**
 * Group the currently selected annotations by the ANNOTATIONS_CREATOR procedure
 * linked to their annotationTemplate (template.procedureKeys).
 *
 * Returns: [{ procedure, annotations: [...] }] — only non-empty groups, only
 * procedures of type ANNOTATIONS_CREATOR. FIXOR procedures are intentionally
 * excluded from the selection panel.
 */
export default function useSelectedAnnotationsByProcedure() {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const selectedItems = useSelector((s) => s.selection.selectedItems);
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  const templates = useAnnotationTemplatesByProject();

  const visibleAnnotations = useAnnotationsV2({
    caller: "useSelectedAnnotationsByProcedure",
    enabled: true,
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
  });

  // helpers

  return useMemo(() => {
    const selectedNodeIds = new Set(
      (selectedItems ?? [])
        .filter((i) => i.type === "NODE" && i.nodeId)
        .map((i) => i.nodeId)
    );
    if (selectedNodeIds.size === 0) return [];

    const templatesById = new Map((templates ?? []).map((t) => [t.id, t]));

    const proceduresByKey = new Map(procedures.map((p) => [p.key, p]));

    // group selected annotations by each CREATOR procedure linked to their
    // template (a template may reference several procedures, so an annotation
    // can land in several groups)
    const annotationsByProcedureKey = new Map();
    for (const annotation of visibleAnnotations ?? []) {
      if (!selectedNodeIds.has(annotation.id)) continue;
      const template = templatesById.get(annotation.annotationTemplateId);
      const procedureKeys = template?.procedureKeys ?? [];

      for (const procedureKey of procedureKeys) {
        const procedure = proceduresByKey.get(procedureKey);
        if (procedure?.type !== "ANNOTATIONS_CREATOR") continue;

        if (!annotationsByProcedureKey.has(procedureKey)) {
          annotationsByProcedureKey.set(procedureKey, []);
        }
        annotationsByProcedureKey.get(procedureKey).push(annotation);
      }
    }

    return [...annotationsByProcedureKey.entries()].map(
      ([procedureKey, annotations]) => ({
        procedure: proceduresByKey.get(procedureKey),
        annotations,
      })
    );
  }, [selectedItems, visibleAnnotations, templates, procedures]);
}
