import { useEffect } from "react";
import { useDispatch } from "react-redux";

import getInitSelectedMainBaseMapId from "Features/init/services/getInitSelectedMainBaseMapId";
import { setSelectedMainBaseMapId } from "../mapEditorSlice";

export default function useInitSelectedMainBaseMap() {
  const dispatch = useDispatch();

  const initBaseMapId = getInitSelectedMainBaseMapId();

  useEffect(() => {
    dispatch(setSelectedMainBaseMapId(initBaseMapId));
  }, []);
}
