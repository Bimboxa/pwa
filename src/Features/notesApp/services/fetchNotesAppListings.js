import { getNotesAppClient } from "./notesAppClient";

import normalizeNotesAppRow from "../utils/normalizeNotesAppRow";

// Live (non-deleted) lists of one notes-app project — feeds the mapping table.
export default async function fetchNotesAppListings(projectId) {
  const client = getNotesAppClient();
  const { data, error } = await client
    .from("listings")
    .select("id,name,icon,color,settings,updated_at")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).map(normalizeNotesAppRow);
}
