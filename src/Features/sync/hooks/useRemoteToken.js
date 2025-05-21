import {useRemoteTokenData} from "../RemoteTokenDataContext";

export default function useRemoteToken() {
  const {remoteTokenData, setRemoteTokenData} = useRemoteTokenData();

  return {value: remoteTokenData?.accessToken};
}
