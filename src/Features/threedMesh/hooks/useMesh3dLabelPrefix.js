import { useCallback } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { DEFAULT_MESH3D_LABEL_PREFIX } from "../utils/mesh3dConstants";

// Auto-numbering prefix for maille labels ("M-" → "M-1"). Stored on the scope
// record (scope.mesh3dSettings.labelPrefix) so it travels with Krto exports.
export default function useMesh3dLabelPrefix() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const scope = useLiveQuery(
    () => (scopeId ? db.scopes.get(scopeId) : null),
    [scopeId]
  );

  const prefix =
    scope?.mesh3dSettings?.labelPrefix ?? DEFAULT_MESH3D_LABEL_PREFIX;

  const setPrefix = useCallback(
    async (newPrefix) => {
      if (!scopeId) return;
      await db.scopes.update(scopeId, {
        "mesh3dSettings.labelPrefix": newPrefix,
      });
    },
    [scopeId]
  );

  return { prefix, setPrefix };
}
