import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

// Stable fallbacks so consumers can safely use them in memo / effect deps.
const EMPTY_SET = new Set();
const EMPTY_ARRAY = [];

// Ids of the base maps whose listing (folder) is disabled for the current
// scope (scope.baseMapsSettings.disabledListingIds). The 3D scene and the 2D
// overlays consume per-base-map toggles (visibleBaseMapIdsIn3d,
// annotationsModeByBaseMapIdIn3d, visibleBaseMapIdsIn2d...) persisted per
// scope: a base map of a folder disabled AFTER its toggle was switched on
// would otherwise keep rendering with no row left in the list to switch it
// off. Read-time guard: the stale ids stay stored and apply again when the
// folder is re-enabled.
//
// The main base map is NOT excluded here (a pure id set): consumers that know
// the main keep it, same rule as SectionBaseMapsList. Light query on the
// `listingId` index — no BaseMap hydration, the hook is mounted many times.
export default function useDisabledBaseMapIds() {
  const { disabledListingIds, synced: scopeSynced } =
    useDisabledBaseMapListingIds();

  const ids = useLiveQuery(
    () =>
      disabledListingIds.length > 0
        ? db.baseMaps.where("listingId").anyOf(disabledListingIds).primaryKeys()
        : EMPTY_ARRAY,
    [disabledListingIds]
  );

  const disabledIds = useMemo(
    () => (ids?.length ? new Set(ids) : EMPTY_SET),
    [ids]
  );
  // Joined key for effect deps (a Set reference changes on each query).
  const disabledKey = useMemo(
    () => [...disabledIds].sort().join(","),
    [disabledIds]
  );
  const synced = scopeSynced && ids !== undefined;

  return { disabledIds, disabledKey, synced };
}
