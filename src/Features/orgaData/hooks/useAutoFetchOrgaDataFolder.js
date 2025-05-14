import {useEffect} from "react";
import {useSelector} from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import fetchOrgaDataFolderService from "../services/fetchOrgaDataFolderService";
import RemoteProvider from "Features/sync/js/RemoteProvider";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import getFetchOrgaDataSuccessInLocalStorage from "../services/getFetchOrgaDataSuccessInLocalStorage";
import setFetchOrgaDataSuccessInLocalStorage from "../services/setFetchOrgaDataSuccessInLocalStorage";

export default function useAutoFetchOrgaDataFolder() {
  const appConfig = useAppConfig();
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();
  const fetchOrgaDataSuccess = getFetchOrgaDataSuccessInLocalStorage();
  const forceUpdateAt = useSelector((s) => s.appConfig.forceUpdateAt);

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
      setFetchOrgaDataSuccessInLocalStorage(true);
    } catch (e) {
      console.error("Error fetching orgaData:", e);
      throw e;
    }
  };

  useEffect(() => {
    if (accessToken && !fetchOrgaDataSuccess && appConfig?.orgaData?.path) {
      fetchFolder();
    }
  }, [
    accessToken,
    fetchOrgaDataSuccess,
    appConfig?.orgaData?.path,
    forceUpdateAt,
  ]);
}
