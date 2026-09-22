import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";
import { getRegenerateIneligibilityReason } from "Features/baseMaps/services/regenerateBaseMapFromPdfPageService";

// Whether "Régénérer depuis le PDF" applies to a base map: shown only for
// PDF-derived base maps (createdFrom.resourceId), enabled when the stored
// page is present locally and the PDF version is still the reference.
// Returns { show, disabled, reason, resource }.
export default function useRegenerateBaseMapEligibility(baseMap) {
  const { isReadOnly } = useReadOnlyScope();
  const baseMapId = baseMap?.id;
  const resourceId = baseMap?.createdFrom?.resourceId;
  const show = Boolean(resourceId) && !baseMap?.isDetail;

  const state = useLiveQuery(async () => {
    if (!show || !baseMapId) return null;
    const record = await db.baseMaps.get(baseMapId);
    const versions = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    const reason = getRegenerateIneligibilityReason(record, versions);
    if (reason) return { reason, resource: null };
    const resource = await resolveDetailResource({
      createdFrom: record.createdFrom,
      projectId: record.projectId,
    });
    if (!resource) {
      return {
        reason: "PDF source absent : rechargez-le depuis le panneau Ressources.",
        resource: null,
      };
    }
    return { reason: null, resource };
  }, [show, baseMapId, resourceId]);

  const reason = isReadOnly
    ? "Scope en lecture seule."
    : state?.reason ?? (state ? null : "Vérification…");

  return {
    show,
    disabled: Boolean(reason),
    reason,
    resource: state?.resource ?? null,
  };
}
