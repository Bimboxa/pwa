import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {fetchServiceCredential} from "../servicesCredentialsSlice";

import useToken from "Features/auth/hooks/useToken";
import useCredentialsMetadata from "./useCredentialsMetadata";

export default function useInitFetchServicesCredentials() {
  const dispatch = useDispatch();
  const token = useToken();

  const credentialsMetadata = useCredentialsMetadata();

  useEffect(() => {
    if (token && credentialsMetadata.length > 0) {
      credentialsMetadata.forEach((metadata) => {
        dispatch(
          fetchServiceCredential({
            token,
            key: metadata.key,
            prefix: metadata.prefix,
          })
        );
      });
    }
  }, [token, credentialsMetadata.length]);
}
