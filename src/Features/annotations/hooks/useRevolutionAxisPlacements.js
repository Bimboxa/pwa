import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

// REVOLUTION_AXIS_PLACEMENT rows of one base map — the axes dropped on that
// elevation. Read straight from Dexie (not from useAnnotationsV2) so a
// placement hidden from the 2D view still shows up in the tools panel, which is
// where its eye toggle lives.
export default function useRevolutionAxisPlacements(baseMapId) {
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const placements = useLiveQuery(async () => {
    if (!baseMapId) return [];
    const rows = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return rows.filter(
      (a) => !a.deletedAt && a.type === "REVOLUTION_AXIS_PLACEMENT"
    );
  }, [baseMapId, annotationsUpdatedAt]);

  return placements ?? [];
}
