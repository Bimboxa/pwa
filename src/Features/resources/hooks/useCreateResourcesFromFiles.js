import { useSelector } from "react-redux";

import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import createResourcesFromFilesService from "../services/createResourcesFromFilesService";

// Creates one resource per dropped/selected file (see
// createResourcesFromFilesService for the storage rules).
//
// options.visibility ("GLOBAL" | "PROJECT" | "SCOPE", default "SCOPE") is the
// resource's scope ("périmètre"): SCOPE rows carry the selected scopeId and
// only show up in that scope's RESOURCES panel (see useResources).
// options.props: extra fields spread on every resource row.
// Throws an Error with code "FILE_TOO_LARGE" above MAX_RESOURCE_FILE_BYTES.
export default function useCreateResourcesFromFiles() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const userProfile = useSelector((s) => s.auth.userProfile);

  return async function createResourcesFromFiles(files, options = {}) {
    // createdBy trigram follows the POV pattern
    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    return createResourcesFromFilesService({
      files,
      projectId,
      scopeId: options.scopeId ?? selectedScopeId ?? null,
      visibility: options.visibility ?? "SCOPE",
      createdBy,
      props: options.props ?? null,
    });
  };
}
