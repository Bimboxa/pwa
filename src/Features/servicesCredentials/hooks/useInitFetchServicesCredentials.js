import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {fetchServicesCredentials} from "../servicesCredentialsSlice";

import useToken from "Features/auth/hooks/useToken";

export default function useInitFetchServicesCredentials() {
  const dispatch = useDispatch();
  const token = useToken();

  useEffect(() => {
    if (token) {
      dispatch(fetchServicesCredentials(token));
    }
  }, [token]);
}
