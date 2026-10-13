import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { isTemplatelessAnnotationInScope } from "Features/annotations/utils/templatelessAnnotations";
import { selectDisabledBaseMapListingIdsKey } from "Features/scopes/selectors/selectDisabledBaseMapListingIds";

// ---------------------------------------------------------------------------
// useTemplatelessCount — "Dessin" tool row counter of PopperDrawingTools: the
// annotations drawn without template on the main base map, in the selected
// scope (eye-hidden ones included, like the template rows). A direct Dexie
// count: the detached popper must not run a second useAnnotationsV2.
// A main base map whose folder is hidden in the scope counts 0 — the main is
// re-selected right after such a hiding (useAutoSelectEnabledBaseMapOnScopeOpen),
// this only covers the window in between.
// ---------------------------------------------------------------------------

export default function useTemplatelessCount() {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const disabledListingIdsKey = useSelector(selectDisabledBaseMapListingIdsKey);

  const count = useLiveQuery(async () => {
    if (!baseMapId || !selectedScopeId) return 0;
    if (disabledListingIdsKey) {
      const baseMap = await db.baseMaps.get(baseMapId);
      if (
        baseMap?.listingId &&
        disabledListingIdsKey.split(",").includes(baseMap.listingId)
      )
        return 0;
    }
    return db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter(
        (a) =>
          !a.deletedAt && isTemplatelessAnnotationInScope(a, selectedScopeId)
      )
      .count();
  }, [baseMapId, selectedScopeId, disabledListingIdsKey]);

  return count ?? 0;
}
