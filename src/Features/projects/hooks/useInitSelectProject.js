import {useEffect} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setSelectedProjectId} from "../projectsSlice";

export default function useInitSelectProject() {
  const dispatch = useDispatch();

  const id = useSelector((s) => s.projects.selectedProjectId);

  const projectsMap = useSelector((s) => s.projects.projectsMap);

  const projects = Object.values(projectsMap);

  const projectsLength = projects.length;
  const project0 = projects[0];

  useEffect(() => {
    if (id === null && projectsLength > 0) {
      dispatch(setSelectedProjectId(project0.id));
    }
  }, [id, projectsLength]);
}
