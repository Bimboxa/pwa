import {useDispatch} from "react-redux";

import useRemoteToken from "Features/sync/hooks/useRemoteToken";

export default function useFetchRemoteProjectSyncData() {
  const dispatch = useDispatch();

  // data

  const {value: token} = useRemoteToken();

  // helpers

  const fetchAsync = async () => {
    try {
      console.log("[ TO DELETE ]");
    } catch (err) {
      console.log("error", err);
    }
  };

  if (token) {
    return fetchAsync;
  } else {
    return null;
  }
}
