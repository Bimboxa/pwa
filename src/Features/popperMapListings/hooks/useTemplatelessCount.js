import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { isTemplatelessAnnotationInScope } from "Features/annotations/utils/templatelessAnnotations";

// ---------------------------------------------------------------------------
// useTemplatelessCount — "Dessin" tool row counter of PopperDrawingTools: the
// annotations drawn without template on the main base map, in the selected
// scope (eye-hidden ones included, like the template rows). A direct Dexie
// count: the detached popper must not run a second useAnnotationsV2.
// ---------------------------------------------------------------------------

export default function useTemplatelessCount() {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const count = useLiveQuery(async () => {
    if (!baseMapId || !selectedScopeId) return 0;
    return db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter(
        (a) =>
          !a.deletedAt && isTemplatelessAnnotationInScope(a, selectedScopeId)
      )
      .count();
  }, [baseMapId, selectedScopeId]);

  return count ?? 0;
}
