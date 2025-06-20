import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteProvider from "Features/sync/hooks/useRemoteProvider";

import fetchRemoteOrgaDataService from "../services/fetchRemoteOrgaDataService";

export default function useFetchRemoteOrgaData() {
  const appConfig = useAppConfig();
  const remoteProvider = useRemoteProvider();

  const fetchRemoteOrgaData = async (orgaDataKey) => {
    try {
      const orgaData = appConfig.orgaData[orgaDataKey];

      // edge case
      if (!orgaData) {
        throw new Error(`OrgaData with key ${orgaDataKey} not found`);
      }

      // main

      await fetchRemoteOrgaDataService({
        orgaData,
        remoteProvider,
      });
    } catch (e) {
      console.error("Error fetching orgaData:", e);
      throw e;
    }
  };

  return fetchRemoteOrgaData;
}
