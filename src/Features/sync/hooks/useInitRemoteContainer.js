import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setRemoteContainer} from "../syncSlice";
import getRemoteContainerFromLocalStorage from "../services/getRemoteContainerFromLocalStorage";

export default function useInitRemoteContainer() {
  const dispatch = useDispatch();

  // data

  const rc = getRemoteContainerFromLocalStorage();

  useEffect(() => {
    console.log("[debug effect] rc.service", rc?.service);
    if (rc?.service) {
      console.log("[effect] setRemoteContainer", rc);
      dispatch(setRemoteContainer(rc));
    }
  }, [rc?.service]);
}
