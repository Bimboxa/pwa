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
  const isDashboard = window.location.pathname === "/dashboard";

  useEffect(() => {
    dispatch(setSelectedProjectId(isDashboard ? null : initProjectId));
    dispatch(setInitSelectProjectDone(true));
  }, []);
}
