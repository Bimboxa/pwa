import {useState, useEffect} from "react";
import {useDispatch} from "react-redux";

import {setRemoteContainer as setRemoteContainerInRedux} from "../syncSlice";
import setRemoteContainerInLocalStorage from "../services/setRemoteContainerInLocalStorage";

import useRemoteContainer from "../hooks/useRemoteContainer";

import SectionRemoteContainerConnected from "./SectionRemoteContainerConnected";
import SectionRemoteContainerDisconnected from "./SectionRemoteContainerDisconnected";
import {useRemoteTokenData} from "../RemoteTokenDataContext";

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
    setRemoteContainer(rcInRedux);
  }, [rcInRedux?.service]);

  // handler

  function handleChange(container) {
    setRemoteContainer(container);
  }

  function handleDisconnexion() {
    setRemoteContainer(null);
    dispatch(setRemoteContainerInRedux(null));
    setRemoteContainerInLocalStorage(null);
    setRemoteTokenData(null);
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
