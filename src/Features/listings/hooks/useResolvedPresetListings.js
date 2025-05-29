import {useState, useEffect} from "react";

import {useSelector} from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

//import resolveListingsToCreateFromPresetListings from "../services/resolveListingsToCreateFromPresetListings";
import resolvePresetListings from "../services/resolvePresetListings";

export default function useResolvedPresetListings() {
  const [listings, setListings] = useState([]);

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const resolveAsync = async () => {
    //const presetListings = Object.values(appConfig?.presetListingsObject);
    // const _listings = await resolveListingsToCreateFromPresetListings(
    //   presetListings
    // );
    const _listings = await resolvePresetListings({projectId, appConfig});
    setListings(_listings);
  };

  useEffect(() => {
    resolveAsync();
  }, [projectId, appConfig?.name]);

  return listings;
}
