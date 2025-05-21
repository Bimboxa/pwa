import {useDispatch, useSelector} from "react-redux";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useRemoteProvider from "Features/sync/hooks/useRemoteProvider";

import {setSelectedProjectId} from "Features/projects/projectsSlice";

import getProjectByClientRef from "Features/projects/services/getProjectByClientRef";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";

export default function useSelectRemoteProject() {
  const dispatch = useDispatch();

  // data

  const remoteProject = useSelector((s) => s.scopeSelector.remoteProject);
  const remoteProvider = useRemoteProvider();

  // data - func

  const createProject = useCreateProject();

  // main

  const select = async () => {
    try {
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

        // case 1 - no local - no remote
        if (!_project) {
          const project = await createProject({
            clientRef,
            name: remoteProject.name,
          });
          projectId = project.id;
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
    } catch (e) {
      console.log("error selecting remote project", project, e);
    }
  };

  // return

  return select;
}
