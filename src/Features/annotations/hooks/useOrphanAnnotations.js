import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { isOrphanCandidate } from "Features/annotations/utils/orphanAnnotations";

// ---------------------------------------------------------------------------
// useOrphanAnnotations — raw Dexie rows of one listing, on the main base map,
// whose template no longer exists (see orphanAnnotations.js). Direct query,
// like useTemplatelessCount: the detached popper must not run a second
// useAnnotationsV2, and eye-hidden orphans must stay counted so the row stays
// listed (greyed) and the eye can be re-enabled.
// ---------------------------------------------------------------------------

const EMPTY = [];

export default function useOrphanAnnotations({ listingId, skip = false } = {}) {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const rows = useLiveQuery(async () => {
    if (skip || !baseMapId || !listingId) return EMPTY;

    const candidates = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter((a) => a.listingId === listingId && isOrphanCandidate(a))
      .toArray();
    if (candidates.length === 0) return EMPTY;

    const templateIds = [
      ...new Set(candidates.map((a) => a.annotationTemplateId)),
    ];
    const templates = await db.annotationTemplates
      .where("id")
      .anyOf(templateIds)
      .toArray();
    const liveTemplateIds = new Set(
      templates.filter((t) => !t.deletedAt).map((t) => t.id)
    );

    const orphans = candidates.filter(
      (a) => !liveTemplateIds.has(a.annotationTemplateId)
    );
    return orphans.length > 0 ? orphans : EMPTY;
  }, [baseMapId, listingId, skip]);

  return rows ?? EMPTY;
}
