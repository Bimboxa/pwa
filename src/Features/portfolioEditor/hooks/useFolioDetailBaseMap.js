import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Raw db record of the detail baseMap shown on a FOLIO_PAGE. New pages store
// folio.detailBaseMapId; older pages are resolved through their source DETAIL
// annotation (annotation.detailBaseMapId). Raw record on purpose: hydrating a
// BaseMap would fire the on-the-fly PDF render of the detail image, which the
// folio page does not need (it renders the PDF page itself).
export default function useFolioDetailBaseMap(page) {
  const detailBaseMapId = page?.folio?.detailBaseMapId ?? null;
  const sourceAnnotationId = page?.sourceAnnotationId ?? null;

  const record = useLiveQuery(async () => {
    let id = detailBaseMapId;
    if (!id && sourceAnnotationId) {
      const annotation = await db.annotations.get(sourceAnnotationId);
      id = annotation?.detailBaseMapId ?? null;
    }
    if (!id) return null;
    const baseMap = await db.baseMaps.get(id);
    if (!baseMap || baseMap.deletedAt) return null;
    return baseMap;
  }, [detailBaseMapId, sourceAnnotationId]);

  return record ?? null;
}
