import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUpdateProject from "./useUpdateProject";
import useRelinkProjectScopeConfigurations from "Features/remoteScopeConfigurations/hooks/useRelinkProjectScopeConfigurations";

// Errors surfaced to the link dialog
export const LINK_ERROR = {
  CLIENT_REF_TAKEN: "CLIENT_REF_TAKEN",
  ID_MASTER_TAKEN: "ID_MASTER_TAKEN",
};

// Links a local project to a référentiel entity (chantier / opportunité):
// copies name / clientRef (master reference) / idMaster / type onto the
// project, then propagates the new fields to its remote scopeConfigurations
// (relink endpoint — pending backend, no-op until configured). detach()
// reverts to a "free" project (idMaster cleared, type reset to the default).

export default function useLinkProjectToReferentiel() {
  // data

  const appConfig = useAppConfig();
  const updateProject = useUpdateProject();
  const relink = useRelinkProjectScopeConfigurations();

  // fallback to the canonical "PROJECT" if the config omits it
  const defaultProjectType =
    appConfig?.creation?.defaultProjectType ?? "PROJECT";

  // helpers

  // Guard: the target référentiel must not already belong to ANOTHER local
  // project (clientRef is a natural key; two local projects on the same
  // chantier is invalid). Throws a LINK_ERROR payload the dialog can render.
  async function assertNoConflict({ projectId, idMaster, clientRef }) {
    if (clientRef) {
      const byRef = await db.projects
        .where("clientRef")
        .equals(clientRef)
        .first();
      if (byRef && byRef.id !== projectId)
        throw { type: LINK_ERROR.CLIENT_REF_TAKEN, project: byRef };
    }
    if (idMaster) {
      const byMaster = await db.projects
        .filter((p) => String(p.idMaster) === String(idMaster))
        .first();
      if (byMaster && byMaster.id !== projectId)
        throw { type: LINK_ERROR.ID_MASTER_TAKEN, project: byMaster };
    }
  }

  // main

  // Link a free project (or re-link an already-linked one) to a référentiel
  // entity. masterProject = { idMaster, name, clientRef, type } (from the
  // masterProjects search / itemsMap).
  const link = async ({ projectId, masterProject }) => {
    await assertNoConflict({
      projectId,
      idMaster: masterProject.idMaster,
      clientRef: masterProject.clientRef,
    });

    // 1) local project: copy name / clientRef (master ref) / idMaster / type
    await updateProject({
      id: projectId,
      name: masterProject.name,
      clientRef: masterProject.clientRef,
      idMaster: masterProject.idMaster,
      type: masterProject.type,
    });

    // 2) remote scopeConfigurations: propagate the new fields in one call
    await relink({
      project: { id: projectId },
      next: {
        idMaster: masterProject.idMaster,
        clientRef: masterProject.clientRef,
        type: masterProject.type,
        name: masterProject.name,
      },
    });
  };

  // Detach: back to a free project. Clears idMaster (falsy = "free" everywhere
  // downstream) but resets type to the default so the project keeps a valid
  // type. name / clientRef are kept.
  const detach = async ({ projectId }) => {
    const before = await db.projects.get(projectId);

    await updateProject({
      id: projectId,
      idMaster: null,
      type: defaultProjectType,
    });

    // clear projectObjectId + reset projectType on the configs;
    // projectNum / projectName are kept as-is
    await relink({
      project: { id: projectId },
      next: {
        idMaster: "", // empty string → backend clears projectObjectId
        clientRef: before?.clientRef ?? "",
        type: defaultProjectType,
        name: before?.name ?? "",
      },
    });
  };

  return { link, detach };
}
