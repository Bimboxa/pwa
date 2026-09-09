import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

const EMPTY = [];

// Global layers of the selected scope (whatever the scope's layers mode) —
// the partition the PLANNING tasks point at (businessObject.globalLayerId).
export default function useGlobalLayers({ scopeId: scopeIdProp } = {}) {
  const layersUpdatedAt = useSelector((s) => s.layers.layersUpdatedAt);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const scopeId = scopeIdProp ?? selectedScopeId;

  const layers = useLiveQuery(async () => {
    if (!scopeId) return [];
    const rows = await db.globalLayers
      .where("scopeId")
      .equals(scopeId)
      .toArray();
    return rows
      .filter((r) => !r.deletedAt)
      .sort((a, b) =>
        String(a.orderIndex ?? "").localeCompare(String(b.orderIndex ?? ""))
      );
  }, [scopeId, layersUpdatedAt]);

  return layers ?? EMPTY;
}
