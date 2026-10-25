import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { isListingTemplatelessAnnotation } from "Features/annotations/utils/templatelessAnnotations";

// ---------------------------------------------------------------------------
// useListingTemplatelessAnnotations — raw Dexie rows of one business-objects
// listing, on the main base map, drawn without template (« Dessin » command
// on an active object of a located listing — see templatelessAnnotations.js).
// Direct query, like useOrphanAnnotations: the detached popper must not run a
// second useAnnotationsV2, and eye-hidden rows must stay counted so the row
// stays listed (greyed) and the eye can be re-enabled.
// ---------------------------------------------------------------------------

const EMPTY = [];

export default function useListingTemplatelessAnnotations({
  listingId,
  skip = false,
} = {}) {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const rows = useLiveQuery(async () => {
    if (skip || !baseMapId || !listingId) return EMPTY;
    const rows = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter(
        (a) => !a.deletedAt && isListingTemplatelessAnnotation(a, listingId)
      )
      .toArray();
    return rows.length > 0 ? rows : EMPTY;
  }, [baseMapId, listingId, skip, annotationsUpdatedAt]);

  return rows ?? EMPTY;
}
