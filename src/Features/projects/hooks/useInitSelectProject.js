import { useEffect } from "react";

import { useDispatch } from "react-redux";

import {
  setSelectedProjectId,
  setInitSelectProjectDone,
} from "../projectsSlice";
import getInitProjectId from "Features/init/services/getInitProjectId";

export default function useInitSelectProject() {
  const dispatch = useDispatch();

  const initProjectId = getInitProjectId();

  useEffect(() => {
    dispatch(setSelectedProjectId(initProjectId));
    dispatch(setInitSelectProjectDone(true));
  }, []);
}
