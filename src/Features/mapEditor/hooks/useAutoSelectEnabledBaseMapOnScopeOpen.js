import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
} from "../mapEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

// Scope-open guarantee: once the base maps and the scope record are loaded,
// a base map of an ENABLED listing (scope.baseMapsSettings.disabledListingIds)
// is selected as the main base map if one exists. The project-keyed selectors
// (useInitSelectedMainBaseMap, useAutoSelectMainBaseMap) never re-evaluate
// the selection on a scope change, so scope B could open on scope A's base
// map — possibly of a listing disabled for B — or on no base map at all.
//
// One pass per scope open (re-armed on the dashboard round-trip): a later
// deliberate deselection by the user is not overridden.
export default function useAutoSelectEnabledBaseMapOnScopeOpen() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  // undefined until the live query resolves — the "loaded" signal.
  const { value: baseMaps } = useBaseMaps();
  const { disabledListingIds, synced } = useDisabledBaseMapListingIds();

  // effects

  const doneScopeIdRef = useRef(null);

  useEffect(() => {
    if (!scopeId) {
      doneScopeIdRef.current = null;
      return;
    }
    if (doneScopeIdRef.current === scopeId) return;
    if (!projectId || baseMaps === undefined || !synced) return;

    // Filter the base maps (not the listings), same rule as the selectors.
    const enabledBaseMaps = (baseMaps ?? []).filter(
      (bm) => !disabledListingIds.includes(bm?.listingId)
    );

    doneScopeIdRef.current = scopeId;

    if (enabledBaseMaps.some((bm) => bm.id === selectedBaseMapId)) return;
    if (enabledBaseMaps.length === 0) return;

    const baseMap0 = enabledBaseMaps[0];
    console.log("[AUTO] select enabled baseMap on scope open", baseMap0.id);
    dispatch(setSelectedBaseMapsListingId(baseMap0.listingId));
    dispatch(setSelectedMainBaseMapId(baseMap0.id));
  }, [
    scopeId,
    projectId,
    baseMaps,
    disabledListingIds,
    synced,
    selectedBaseMapId,
    dispatch,
  ]);
}
