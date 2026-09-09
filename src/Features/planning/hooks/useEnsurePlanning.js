import { useEffect, useRef } from "react";

import usePlanningActions from "./usePlanningActions";

// Lazily creates the planning of a listing when the panel opens on a listing
// without one (one planning per listing in v1). `loading` = the live query
// has not answered yet; never create before it did.
export default function useEnsurePlanning({
  listing,
  planning,
  loading,
  enabled,
}) {
  const { createPlanning } = usePlanningActions();
  const creatingRef = useRef(null);

  useEffect(() => {
    if (!enabled || !listing?.id || loading || planning) return;
    if (creatingRef.current === listing.id) return;
    creatingRef.current = listing.id;
    createPlanning({ listing }).catch((e) => {
      console.error("[useEnsurePlanning]", e);
      creatingRef.current = null;
    });
  }, [enabled, listing, loading, planning, createPlanning]);
}
