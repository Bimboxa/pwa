import {useDispatch} from "react-redux";

import {createOrUpdateServiceCredential} from "../servicesCredentialsSlice";

import useToken from "Features/auth/hooks/useToken";

export default function useCreateOrUpdateCredentialService() {
  const dispatch = useDispatch();
  const token = useToken();

  const createOrUpdate = async ({key, prefix, value}) => {
    console.log("createOrUpdate", key, prefix, value);
    dispatch(
      createOrUpdateServiceCredential({
        token,
        key,
        prefix,
        value,
      })
    );
  };

  return createOrUpdate;
}
