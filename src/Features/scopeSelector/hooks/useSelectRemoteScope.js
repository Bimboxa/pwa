import {useDispatch, useSelector} from "react-redux";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import {setSelectedProjectId} from "Features/projects/projectsSlice";
import {setSelectedScopeId} from "Features/scopes/scopesSlice";

import RemoteProvider from "Features/sync/js/RemoteProvider";

import getProjectByClientRef from "Features/projects/services/getProjectByClientRef";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";

export default function useSelectRemoteScope() {
  const dispatch = useDispatch();

  // data

  const remoteProject = useSelector((s) => s.scopeSelector.remoteProject);
  const scopesById = useSelector((s) => s.scopes.scopesById);
  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // data - func

  const createProject = useCreateProject();
  const createScope = useCreateScope();

  // main

  const select = async (scope) => {
    try {
      // init
      const remoteProvider = new RemoteProvider({
        accessToken,
        provider: remoteContainer.service,
      });

      // step 1 - fetch local project
      const clientRef = remoteProject.clientRef;
      const localProject = await getProjectByClientRef(clientRef);

      let projectId = localProject?.id;

      if (!localProject) {
        // step 2 - fetch project data
        const path = getRemoteItemPath({item: remoteProject, type: "PROJECT"});
        const projectFile = await remoteProvider.downloadFile(path);
        const result = await jsonFileToObjectAsync(projectFile);
        const _project = result.data;

        // case 1 - no local - no remote
        if (!_project) {
          const project = await createProject({
            clientRef,
            name: remoteProject.name,
          });
          projectId = project.id;
        } else {
          // case 2 - no local - remote
          await createProject({
            clientRef,
            name: remoteProject.name,
            id: _project?.id,
          });
          projectId = _project.id;
        }
      }
      dispatch(setSelectedProjectId(projectId));

      // step 2 - fetch local scope
      const localScope = scopesById[scope.id];
      if (!localScope) {
        const name = scope.name;
        const clientRef = scope.clientRef;
        const sortedListingsIds = scope.sortedListingsIds ?? [];
        const createdBy = scope.createdBy;
        const createdAt = scope.createdAt;
        const id = scope.id;

        await createScope({
          id,
          name,
          clientRef,
          projectId,
          createdBy,
          createdAt,
          sortedListingsIds,
        });
      }
      dispatch(setSelectedScopeId(scope.id));
    } catch (e) {
      console.log("error selecting remote scope", scope, e);
    }
  };

  // return

  return select;
}
