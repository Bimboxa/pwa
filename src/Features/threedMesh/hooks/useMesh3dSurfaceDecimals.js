import { useCallback } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { DEFAULT_MESH3D_SURFACE_DECIMALS } from "../utils/mesh3dConstants";

// Decimals used to display maille surfaces (1 | 2 | 3). Stored on the scope
// record (scope.mesh3dSettings.surfaceDecimals) so it travels with Krto
// exports, like the label prefix.
export default function useMesh3dSurfaceDecimals() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const scope = useLiveQuery(
    () => (scopeId ? db.scopes.get(scopeId) : null),
    [scopeId]
  );

  const surfaceDecimals =
    scope?.mesh3dSettings?.surfaceDecimals ?? DEFAULT_MESH3D_SURFACE_DECIMALS;

  const setSurfaceDecimals = useCallback(
    async (newDecimals) => {
      if (!scopeId) return;
      await db.scopes.update(scopeId, {
        "mesh3dSettings.surfaceDecimals": newDecimals,
      });
    },
    [scopeId]
  );

  return { surfaceDecimals, setSurfaceDecimals };
}
