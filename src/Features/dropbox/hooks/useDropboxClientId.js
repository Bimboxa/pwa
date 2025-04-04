import useRemoteContainer from "src/Features/remote/hooks/useRemoteContainer";
export default function useDropboxClientId() {
  const remoteContainer = useRemoteContainer();
  const clientId = remoteContainer?.clientId;
  return clientId;
}
