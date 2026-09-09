import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import { selectLayersMode } from "Features/scopeConfig/utils/scopeConfigSelectors";

import { getLayersAsync } from "../utils/layersMode";

// Layers of a base map, sorted. Mode-aware (scopeConfigs.layersMode): in
// GLOBAL mode the scope's global layers are returned for every base map
// (filterByBaseMapId is then only a "a base map is displayed" gate).
export default function useLayers({ filterByBaseMapId, filterByScopeId } = {}) {
  const layersUpdatedAt = useSelector((s) => s.layers.layersUpdatedAt);
  const mode = useSelector(selectLayersMode);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const scopeId =
    filterByScopeId ?? (mode === "GLOBAL" ? selectedScopeId : null);

  const layers = useLiveQuery(async () => {
    if (!filterByBaseMapId) return [];
    return getLayersAsync({ mode, baseMapId: filterByBaseMapId, scopeId });
  }, [filterByBaseMapId, scopeId, mode, layersUpdatedAt]);

  return layers;
}
