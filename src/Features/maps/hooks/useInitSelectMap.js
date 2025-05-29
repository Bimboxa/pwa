import {useEffect} from "react";
import {useDispatch} from "react-redux";

import getInitMapId from "Features/init/services/getInitMapId";
import {setSelectedMapId} from "../mapsSlice";

export default function useInitSelectMap() {
  const dispatch = useDispatch();

  const initMapId = getInitMapId();

  useEffect(() => {
    dispatch(setSelectedMapId(initMapId));
  });
}
