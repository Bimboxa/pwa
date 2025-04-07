import {useState} from "react";

import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import getItemMetadataDropboxService from "Features/dropbox/services/getItemMetadataDropboxService";

export default function useFetchRemoteItemMetadata() {
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  if (!remoteContainer || !accessToken) {
    return null;
  }
  return async (path) => {
    if (!remoteContainer) {
      throw new Error("No remote container available");
    }
    switch (remoteContainer.service) {
      case "DROPBOX":
        return getItemMetadataDropboxService({path, accessToken});
      default:
        throw new Error(`Unknown service: ${remoteContainer.service}`);
    }
  };
}
