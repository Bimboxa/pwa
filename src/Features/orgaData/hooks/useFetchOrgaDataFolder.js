import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteProvider from "Features/sync/hooks/useRemoteProvider";

import fetchOrgaDataFolderService from "../services/fetchOrgaDataFolderService";
import RemoteProvider from "Features/sync/js/RemoteProvider";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

export default function useFetchOrgaDataFolder() {
  const appConfig = useAppConfig();
  const remoteProvider = useRemoteProvider();

  const fetchFolder = async () => {
    try {
      const orgaData = appConfig.orgaData;

      // edge case
      if (!orgaData) {
        throw new Error(`OrgaData not found`);
      }

      // main
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
