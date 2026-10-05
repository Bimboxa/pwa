import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationTemplatesByProject from "Features/annotations/hooks/useAnnotationTemplatesByProject";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getProceduresForAnnotation from "../utils/getProceduresForAnnotation";

/**
 * Group the currently selected annotations by the ANNOTATIONS_CREATOR
 * procedures they can source (getProceduresForAnnotation: template links,
 * listing links + source mapping categories).
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

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listings = useLiveQuery(
    () =>
      projectId
        ? db.listings.where("projectId").equals(projectId).toArray()
        : [],
    [projectId]
  );

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
    const listingsById = new Map((listings ?? []).map((l) => [l.id, l]));

    // group selected annotations by each CREATOR procedure they can source
    // (an annotation can land in several groups)
    const annotationsByProcedureKey = new Map();
    for (const annotation of visibleAnnotations ?? []) {
      if (!selectedNodeIds.has(annotation.id)) continue;
      const linkedProcedures = getProceduresForAnnotation(
        annotation,
        procedures,
        {
          template: templatesById.get(annotation.annotationTemplateId),
          listing: listingsById.get(annotation.listingId),
        }
      );
      // template-less type sources are launched from the toolbar only
      for (const procedure of linkedProcedures) {
        if ((procedure.sourceAnnotationTypes ?? []).includes(annotation.type))
          continue;
        if (!annotationsByProcedureKey.has(procedure.key)) {
          annotationsByProcedureKey.set(procedure.key, []);
        }
        annotationsByProcedureKey.get(procedure.key).push(annotation);
      }
    }

    return [...annotationsByProcedureKey.entries()].map(
      ([procedureKey, annotations]) => ({
        procedure: proceduresByKey.get(procedureKey),
        annotations,
      })
    );
  }, [selectedItems, visibleAnnotations, templates, procedures, listings]);
}
