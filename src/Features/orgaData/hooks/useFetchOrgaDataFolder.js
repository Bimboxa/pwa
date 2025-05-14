import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import fetchOrgaDataFolderService from "../services/fetchOrgaDataFolderService";
import RemoteProvider from "Features/sync/js/RemoteProvider";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

export default function useFetchOrgaDataFolder() {
  const appConfig = useAppConfig();
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  const fetchFolder = async () => {
    try {
      const orgaData = appConfig.orgaData;

      // edge case
      if (!orgaData) {
        throw new Error(`OrgaData not found`);
      }

      // main
      const remoteProvider = new RemoteProvider({
        accessToken,
        provider: remoteContainer.service,
      });

      await fetchOrgaDataFolderService({
        orgaData,
        remoteProvider,
      });
    } catch (e) {
      console.error("Error fetching orgaData:", e);
      throw e;
    }
  };

  return fetchFolder;
}
