import {useState, useEffect} from "react";
import {useDispatch} from "react-redux";

import {
  setRemoteContainer as setRemoteContainerInRedux,
  setSignedOut,
} from "../syncSlice";
import setRemoteContainerInLocalStorage from "../services/setRemoteContainerInLocalStorage";

import useRemoteContainer from "../hooks/useRemoteContainer";

import SectionRemoteContainerConnected from "./SectionRemoteContainerConnected";
import SectionRemoteContainerDisconnected from "./SectionRemoteContainerDisconnected";
import {useRemoteTokenData} from "../RemoteTokenDataContext";

import setSignedOutInLocalStorage from "../services/setSignedOutInLocalStorage";

export default function SectionRemoteContainer() {
  const dispatch = useDispatch();

  // state

  const [remoteContainer, setRemoteContainer] = useState(null);
  console.log(
    "[SectionRemoteContainer] remoteContainer",
    remoteContainer?.service
  );

  // data

  const rcInRedux = useRemoteContainer();
  const {setRemoteTokenData} = useRemoteTokenData();

  useEffect(() => {
    if (rcInRedux?.service) {
      setRemoteContainer(rcInRedux);
    }
  }, [rcInRedux?.service]);

  // handler

  function handleChange(container) {
    setRemoteContainer(container);
  }

  function handleDisconnexion() {
    try {
      console.log("[SectionRemoteContainer] handleDisconnexion");
      setRemoteContainer(null);
      dispatch(setRemoteContainerInRedux(null));
      setRemoteContainerInLocalStorage(null);
      setRemoteTokenData(null);
      dispatch(setSignedOut(true));
      setSignedOutInLocalStorage(true);
    } catch (e) {
      console.error("[SectionRemoteContainer] error handleDisconnexion", e);
    }
  }
  // render

  if (remoteContainer) {
    return (
      <SectionRemoteContainerConnected
        remoteContainer={remoteContainer}
        onDisconnexion={handleDisconnexion}
      />
    );
  } else {
    return <SectionRemoteContainerDisconnected onChange={handleChange} />;
  }
}
