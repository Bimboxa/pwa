import {useState, useEffect} from "react";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useRemoteServiceKey from "./useRemoteServiceKey";
import useRemoteToken from "./useRemoteToken";
import useRemoteProjectContainerProps from "./useRemoteProjectContainerProps";
import getFolderMetadata from "Features/dropbox/services/getFolderMetadataDropboxService";

export default function useRemoteListingContainerProps() {
  // data

  const {value: listing} = useSelectedListing();
  const remoteServiceKey = useRemoteServiceKey();
  const accessToken = useRemoteToken();
  const {value: projectProps} = useRemoteProjectContainerProps();

  // state

  const [loading, setLoading] = useState(false);
  const [props, setProps] = useState(null);

  // effect

  useEffect(() => {
    if (listing) {
      getPropsAsync();
    }
  }, [listing?.id]);

  // helper

  const getPropsAsync = async () => {
    console.log("[fetching remote listing props]");
    setLoading(true);
    if (remoteServiceKey === "DROPBOX") {
      // path
      const folderName = listing.entityModelKey + "::" + listing.id;
      const rootPath = projectProps?.dropboxFolder.path_display;
      const path = rootPath + "/listings/" + folderName;

      // service
      const metadata = await getFolderMetadata({path, accessToken});

      const props = {
        type: "DROPBOX_FOLDER",
        dropboxFolder: metadata,
      };

      // set props
      setProps(props);
      setLoading(false);
    }
  };

  return {value: props, loading};
}
