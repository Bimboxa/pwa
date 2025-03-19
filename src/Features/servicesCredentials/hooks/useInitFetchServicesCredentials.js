import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {fetchServicesCredentials} from "Features/servicesCredentials/services";

import useToken from "Features/auth/hooks/useToken";

export default function useInitFetchServicesCredentials() {
  const dispatch = useDispatch();
  const token = useToken();

  useEffect(() => {
    if (token) {
      fetchServicesCredentials(token);
    }
  }, [token]);
}
