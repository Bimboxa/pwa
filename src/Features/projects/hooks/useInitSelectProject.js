import {useEffect} from "react";

import {useSelector, useDispatch} from "react-redux";

import useProjects from "./useProjects";

import {setSelectedProjectId} from "../projectsSlice";
import getInitProjectId from "Features/init/services/getInitProjectId";

export default function useInitSelectProject() {
  const dispatch = useDispatch();

  const initProjectId = getInitProjectId();

  useEffect(() => {
    dispatch(setSelectedProjectId(initProjectId));
  }, []);
}
