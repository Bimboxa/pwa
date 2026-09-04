import { getNotesAppClient } from "./notesAppClient";

import normalizeNotesAppRow, { toCamelCase } from "../utils/normalizeNotesAppRow";

// Full project snapshot via the get_project_changes RPC. p_since 0 returns
// everything, soft-deleted rows included — needed to propagate deletions.
// Tables come back keyed snake_case (base_maps, entity_models, ...): the dump
// is re-keyed camelCase with every row normalized (camelCase keys, parsed
// JSON payload columns, second->ms timestamps).
export default async function fetchNotesAppProjectDump(projectId) {
  const client = getNotesAppClient();
  const { data, error } = await client.rpc("get_project_changes", {
    p_project_id: projectId,
    p_since: 0,
  });
  if (error) throw error;

  const dump = {};
  for (const [table, rows] of Object.entries(data ?? {})) {
    dump[toCamelCase(table)] = Array.isArray(rows)
      ? rows.map(normalizeNotesAppRow)
      : [];
  }
  return dump;
}
