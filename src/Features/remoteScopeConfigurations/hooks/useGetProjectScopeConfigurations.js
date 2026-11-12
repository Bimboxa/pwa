import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeConfigurationsByProject from "./useScopeConfigurationsByProject";
import useSearchScopeConfigurations from "./useSearchScopeConfigurations";

// Returns an async function fetching the remote scope configurations of a
// project: `({ idMaster, clientRef, projectId }) => configurations[]`.
//
// Uses the ByProject endpoint when the project has an idMaster (chantier
// IdObject); falls back to SearchAndFilters with the clientRef (projectNum)
// when there is no idMaster, or when ByProject fails or returns nothing —
// configurations pushed from a project without idMaster have no
// projectObjectId on the server and are only reachable via projectNum.
// `idMaster` is expected normalized (see normalizeProjectIdMaster).

export default function useGetProjectScopeConfigurations() {
  // data

  const appConfig = useAppConfig();
  const getByProject = useScopeConfigurationsByProject();
  const searchConfigurations = useSearchScopeConfigurations();

  const getByProjectConfig =
    appConfig?.features?.remoteScopeConfigurations?.getByProject;
  const searchConfig =
    appConfig?.features?.remoteScopeConfigurations?.searchAndFilters;

  // main

  return async function getProjectScopeConfigurations({
    idMaster,
    clientRef,
    projectId,
  }) {
    let configurations;
    if (idMaster && getByProjectConfig) {
      try {
        configurations = await getByProject({ project: { idMaster } });
      } catch (error) {
        console.error("[remoteScopeConfigurations] getByProject error", error);
      }
    }

    if (!configurations?.length && clientRef && searchConfig) {
      // no idMaster, or ByProject failed / returned nothing —
      // search by clientRef (backend matches projectNum)
      const results = await searchConfigurations({
        searchValue: clientRef,
      });
      // projectIdClient (immutable client project id) is the unambiguous
      // match; clientRef only covers older configs pushed without it
      configurations = (results ?? []).filter(
        (config) =>
          (config.projectIdClient &&
            String(config.projectIdClient) === projectId) ||
          String(config.projectClientRef) === clientRef
      );
    }

    return configurations ?? [];
  };
}
