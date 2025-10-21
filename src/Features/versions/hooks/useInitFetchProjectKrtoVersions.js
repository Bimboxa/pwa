import { useEffect, useRef } from "react";

import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setVersions } from "../versionsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import listKrtoVersionsService from "../services/listKrtoVersionsService";

export default function useInitFetchProjectKrtoVersions() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();
  const orgaCode = appConfig?.orgaCode;
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const syncingRef = useRef(false);

  useEffect(() => {
    const fetchVersions = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      const versions = await listKrtoVersionsService({ orgaCode, projectId });
      console.log("fetch versions", versions);
      dispatch(setVersions(versions?.media ?? []));
      syncingRef.current = false;
    };
    if (projectId && orgaCode) {
      fetchVersions();
    }
  }, [projectId, orgaCode]);
}
