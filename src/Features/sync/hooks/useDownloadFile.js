import useRemoteProvider from "./useRemoteProvider";

export default function useDownloadFile() {
  const remoteProvider = useRemoteProvider();

  const download = async (path) => {
    return await remoteProvider.downloadFile(path);
  };

  return download;
}
