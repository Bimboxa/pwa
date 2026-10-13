import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
} from "../mapEditorSlice";
import { setBaseMapsGridSelectedBaseMapId } from "Features/baseMapsGrid/baseMapsGridSlice";

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
//
// Hidden-folder follow-up: when a folder is hidden from the SCOPE module
// while one of its base maps is the main one (or the grid's selected sheet),
// the main switches to the first base map of a visible folder (none left ->
// no main), and the stale grid selection is cleared. A hidden folder does not
// exist for the scope: nothing may keep showing one of its base maps.
export default function useAutoSelectEnabledBaseMapOnScopeOpen() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const gridSelectedBaseMapId = useSelector(
    (s) => s.baseMapsGrid.selectedBaseMapId
  );
  // undefined until the live query resolves — the "loaded" signal. Every
  // base map, hidden folders included: the stale main must still be found
  // to know it belongs to a hidden folder.
  const { value: baseMaps } = useBaseMaps({ includeDisabledListings: true });
  const { disabledListingIds, synced } = useDisabledBaseMapListingIds();

  // helpers

  const isEnabled = (bm) => !disabledListingIds.includes(bm?.listingId);

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
    const enabledBaseMaps = (baseMaps ?? []).filter(isEnabled);

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

  // Folder hidden while one of its base maps is selected. The test is "the
  // selection belongs to a hidden folder", not "the selection is not in the
  // enabled list": a deliberate deselection (or a deleted base map) must not
  // trigger a re-selection here.
  useEffect(() => {
    if (!scopeId || baseMaps === undefined || !synced) return;
    if (disabledListingIds.length === 0) return;
    const byId = new Map((baseMaps ?? []).map((bm) => [bm.id, bm]));
    const isStale = (id) => {
      const bm = id ? byId.get(id) : null;
      return Boolean(bm) && !isEnabled(bm);
    };

    if (isStale(selectedBaseMapId)) {
      const next = (baseMaps ?? []).find(isEnabled) ?? null;
      console.log(
        "[AUTO] main baseMap folder hidden, switch to",
        next?.id ?? null
      );
      dispatch(setSelectedBaseMapsListingId(next?.listingId ?? null));
      dispatch(setSelectedMainBaseMapId(next?.id ?? null));
    }
    if (isStale(gridSelectedBaseMapId)) {
      dispatch(setBaseMapsGridSelectedBaseMapId(null));
    }
  }, [
    scopeId,
    baseMaps,
    disabledListingIds,
    synced,
    selectedBaseMapId,
    gridSelectedBaseMapId,
    dispatch,
  ]);
}
