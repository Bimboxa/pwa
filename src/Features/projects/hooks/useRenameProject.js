import db from "App/db/db";

import useUpdateProject from "./useUpdateProject";
import { LINK_ERROR } from "./useLinkProjectToReferentiel";
import useUpdateProjectScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useUpdateProjectScopeConfigurations";

// Renames a free (unlinked) local project and/or changes its number
// (clientRef), then propagates the new fields to its remote
// scopeConfigurations (updateProject endpoint — no-op until configured).

export default function useRenameProject() {
  // data

  const updateProject = useUpdateProject();
  const updateRemote = useUpdateProjectScopeConfigurations();

  // helpers

  // Guard: the new clientRef must not already belong to ANOTHER local project
  // (clientRef is a natural key). Throws a LINK_ERROR payload the dialog can
  // render.
  async function assertNoConflict({ projectId, clientRef }) {
    if (!clientRef) return;
    const byRef = await db.projects
      .where("clientRef")
      .equals(clientRef)
      .first();
    if (byRef && byRef.id !== projectId)
      throw { type: LINK_ERROR.CLIENT_REF_TAKEN, project: byRef };
  }

  // main

  const rename = async ({ projectId, name, clientRef }) => {
    await assertNoConflict({ projectId, clientRef });

    // 1) local project
    await updateProject({ id: projectId, name, clientRef });

    // 2) remote scopeConfigurations: propagate the new fields in one call
    await updateRemote({ project: { id: projectId, name, clientRef } });
  };

  return rename;
}
