import {useEffect} from "react";
import {useDispatch} from "react-redux";

import getInitScopeId from "Features/init/services/getInitScopeId";
import {setSelectedScopeId} from "../scopesSlice";

export default function useInitSelectScope() {
  const dispatch = useDispatch();

  const initScopeId = getInitScopeId();

  useEffect(() => {
    dispatch(setSelectedScopeId(initScopeId));
  });
}
