import { getNotesAppClient } from "./notesAppClient";

// Projects the signed-in notes-app user can access (owner, direct member or
// via organization). claim_invites first so freshly invited projects appear.
export default async function fetchNotesAppProjects() {
  const client = getNotesAppClient();
  try {
    await client.rpc("claim_invites");
  } catch (e) {
    console.log("[notesApp] claim_invites failed", e);
  }
  const { data, error } = await client.rpc("get_shared_projects");
  if (error) throw error;

  // get_shared_projects unions direct membership and org membership: the same
  // project can come back twice — dedupe by project id.
  const byId = new Map();
  for (const row of data ?? []) {
    if (!row?.project_id || byId.has(row.project_id)) continue;
    byId.set(row.project_id, {
      projectId: row.project_id,
      projectName: row.project_name,
      role: row.role,
    });
  }
  return [...byId.values()];
}
