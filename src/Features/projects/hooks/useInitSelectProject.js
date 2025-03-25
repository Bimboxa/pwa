import {useEffect} from "react";

import {useSelector, useDispatch} from "react-redux";

import useProjects from "./useProjects";

import {setSelectedProjectId} from "../projectsSlice";

export default function useInitSelectProject() {
  const dispatch = useDispatch();

  const id = useSelector((s) => s.projects.selectedProjectId);

  const {value: projects, loading} = useProjects();

  const projectsLength = loading ? 0 : projects?.length;
  const project0 = loading ? null : projects[0];

  useEffect(() => {
    if (id === null && projectsLength > 0) {
      dispatch(setSelectedProjectId(project0.id));
    }
  }, [id, projectsLength]);
}
