import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import migrateRevolutionAxesToScopeService from "../services/migrateRevolutionAxesToScopeService";

// App init + every scope opening: detaches the template-driven revolution
// axes from their listing (base map + scope objects now — no-op on a clean
// database). Re-run per scope so the rows of a Krto zip loaded later are
// migrated as well.
export default function useInitMigrateRevolutionAxes() {
  const dispatch = useDispatch();
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { migrated, deletedTemplates } =
          await migrateRevolutionAxesToScopeService();
        if (cancelled) return;
        if (migrated > 0 || deletedTemplates > 0) {
          dispatch(triggerAnnotationsUpdate());
          dispatch(triggerAnnotationTemplatesUpdate());
          console.log(
            `[migrateRevolutionAxes] ${migrated} axis row(s) detached, ${deletedTemplates} template(s) removed`
          );
        }
      } catch (e) {
        console.error("[migrateRevolutionAxes]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, scopeId]);
}
