import {useEffect, useRef} from "react";
import {useSelector} from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteProvider from "Features/sync/hooks/useRemoteProvider";

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

  const syncingRef = useRef(false);

  const remoteProvider = useRemoteProvider();

  const rpBoolean = Boolean(remoteProvider);

  const fetchFolder = async () => {
    try {
      if (syncingRef.current) return;
      const orgaData = appConfig.orgaData;

      // edge case
      if (!orgaData) {
        throw new Error(`OrgaData not found`);
      }

      // syncing
      syncingRef.current = true;
      await fetchOrgaDataFolderService({
        orgaData,
        remoteProvider,
      });
      syncingRef.current = false;
      setFetchOrgaDataSuccessInLocalStorage(true);
    } catch (e) {
      console.error("Error fetching orgaData:", e);
      throw e;
    }
  };

  useEffect(() => {
    if (rpBoolean && !fetchOrgaDataSuccess && appConfig?.orgaData?.path) {
      fetchFolder();
    }
  }, [
    fetchOrgaDataSuccess,
    appConfig?.orgaData?.path,
    forceUpdateAt,
    rpBoolean,
  ]);
}
