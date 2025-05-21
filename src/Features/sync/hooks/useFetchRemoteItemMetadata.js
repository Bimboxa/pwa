import useRemoteProvider from "./useRemoteProvider";

export default function useFetchRemoteItemMetadata() {
  const remoteProvider = useRemoteProvider();

  if (!remoteProvider) return null;

  return async (path) => {
    return await remoteProvider.fetchItemMetadata(path);
  };
}
