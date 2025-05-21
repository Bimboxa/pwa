import {useState, useEffect} from "react";

import RemoteProvider from "../js/RemoteProvider";

import {useSelector} from "react-redux";
import useRemoteContainer from "./useRemoteContainer";
import useRemoteToken from "./useRemoteToken";

export default function useRemoteProvider() {
  const [remoteProvider, setRemoteProvider] = useState();

  // data

  const remoteContainer = useRemoteContainer();
  const userAccount = useSelector((s) => s.sync.rcUserAccount);
  const {value: accessToken} = useRemoteToken();

  const userAccountBoolean = Boolean(userAccount);

  useEffect(() => {
    if (accessToken && userAccountBoolean) {
      const rp = new RemoteProvider({
        accessToken,
        provider: remoteContainer.service,
        userAccount,
      });
      setRemoteProvider(rp);
    }
  }, [accessToken, userAccountBoolean]);

  return remoteProvider;
}
