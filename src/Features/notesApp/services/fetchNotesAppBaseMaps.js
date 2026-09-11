import { getNotesAppClient } from "./notesAppClient";

import normalizeNotesAppRow from "../utils/normalizeNotesAppRow";

// Live (non-deleted) plans of one notes-app project — feeds the plans
// mapping table. `settings` carries the plan <-> location association
// (settings.locationEntityIds) and the calibration (settings.scale).
export default async function fetchNotesAppBaseMaps(projectId) {
  const client = getNotesAppClient();
  const { data, error } = await client
    .from("base_maps")
    .select("id,name,image_storage_path,settings,updated_at")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).map(normalizeNotesAppRow);
}
