import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
export default function useDropboxClientId() {
  const remoteContainer = useRemoteContainer();
  const clientId = remoteContainer?.clientId;
  return clientId;
}
