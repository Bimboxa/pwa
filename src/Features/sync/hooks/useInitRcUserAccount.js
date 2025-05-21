import {useEffect, useRef} from "react";
import {useSelector, useDispatch} from "react-redux";

import useRemoteContainer from "./useRemoteContainer";

import useRemoteToken from "./useRemoteToken";

import useRemoteProvider from "./useRemoteProvider";

import RemoteProvider from "../js/RemoteProvider";
import {setRcUserAccount} from "../syncSlice";
import getUserAccountDropboxService from "Features/dropbox/services/getUserAccountDropboxService";

export default function useInitRcUserAccount() {
  const dispatch = useDispatch();
  const syncingRef = useRef();

  // const remoteProvider = useRemoteProvider(); // remoteProvider depends on userAccount /!\ circular deps => use rc services directly

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  const getAccountAsync = async () => {
    syncingRef.current = true;

    let userAccount = {};
    switch (remoteContainer?.service) {
      case "DROPBOX":
        userAccount = await getUserAccountDropboxService({accessToken});
        break;
      default:
        userAccount = {};
    }
    dispatch(setRcUserAccount(userAccount));
    syncingRef.current = false;
  };

  useEffect(() => {
    if (remoteContainer?.service && !syncingRef.current && accessToken) {
      getAccountAsync();
    }
  }, [remoteContainer?.service, accessToken]);
}
