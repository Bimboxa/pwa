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
import updateSyncFile from "Features/sync/services/updateSyncFile";

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

  const select = async (remoteScope) => {
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
        const {path} = await getRemoteItemPath({
          item: remoteProject,
          type: "PROJECT",
        });
        const projectFile = await remoteProvider.downloadFile(path);
        const result = await jsonFileToObjectAsync(projectFile);
        const _project = result.data;
        console.log(
          "[useSelectRemoteScope] project from syncFile remote",
          _project
        );

        // case 1 - no local - no remote
        if (!_project) {
          console.log("error selecting remote scope - no project");
        } else {
          // case 2 - no local - remote
          await createProject(
            {
              clientRef,
              name: remoteProject.name,
              id: _project?.id,
            },
            {
              updateSyncFile: true,
              updatedAt: remoteProject.lastModifiedAt,
              syncAt: remoteProject.lastModifiedAt,
            }
          );
          projectId = _project.id;
        }
      }
      dispatch(setSelectedProjectId(projectId));

      // step 2 - fetch local scope
      const localScope = scopesById[remoteScope.id];
      if (!localScope) {
        const name = remoteScope.name;
        const clientRef = remoteScope.clientRef;
        const sortedListings = remoteScope.sortedListings ?? [];
        const createdBy = remoteScope.createdBy;
        const createdAt = remoteScope.createdAt;
        const id = remoteScope.id;

        await createScope(
          {
            id,
            name,
            clientRef,
            projectId,
            createdBy,
            createdAt,
            sortedListings,
          },
          {updateSyncFile: true}
        );
      }
      dispatch(setSelectedScopeId(id));
    } catch (e) {
      console.log("error selecting remote scope", e);
    }
  };

  // return

  return select;
}
