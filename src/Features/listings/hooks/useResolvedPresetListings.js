import { useState, useEffect } from "react";

import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

//import resolveListingsToCreateFromPresetListings from "../services/resolveListingsToCreateFromPresetListings";
import resolvePresetListings from "../services/resolvePresetListings";

export default function useResolvedPresetListings() {
  const [listings, setListings] = useState([]);

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const resolveAsync = async () => {
    //const presetListings = Object.values(appConfig?.presetListingsObject);
    // const _listings = await resolveListingsToCreateFromPresetListings(
    //   presetListings
    // );
    const _listings = await resolvePresetListings({
      projectId,
      scopeId,
      appConfig,
    });
    setListings(_listings);
  };

  useEffect(() => {
    if (projectId && appConfig?.name) resolveAsync();
  }, [projectId, appConfig?.name, scopeId]);

  return listings;
}
