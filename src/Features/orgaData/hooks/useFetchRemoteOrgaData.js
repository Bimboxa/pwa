import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import fetchRemoteOrgaDataService from "../services/fetchRemoteOrgaDataService";
import RemoteProvider from "Features/sync/js/RemoteProvider";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

export default function useFetchRemoteOrgaData() {
  const appConfig = useAppConfig();
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  const fetchRemoteOrgaData = async (orgaDataKey) => {
    try {
      const orgaData = appConfig.orgaData[orgaDataKey];

      // edge case
      if (!orgaData) {
        throw new Error(`OrgaData with key ${orgaDataKey} not found`);
      }

      // main
      const remoteProvider = new RemoteProvider({
        accessToken,
        provider: remoteContainer.service,
      });

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
