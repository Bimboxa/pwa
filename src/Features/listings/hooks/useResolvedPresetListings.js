import {useState, useEffect} from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import resolveListingsToCreateFromPresetListings from "../services/resolveListingsToCreateFromPresetListings";

export default function useResolvedPresetListings() {
  const [listings, setListings] = useState([]);

  const appConfig = useAppConfig();

  const resolveAsync = async () => {
    const presetListings = Object.values(appConfig?.presetListingsObject);
    const _listings = await resolveListingsToCreateFromPresetListings(
      presetListings
    );
    setListings(_listings);
  };

  useEffect(() => {
    resolveAsync();
  }, []);

  return listings;
}
