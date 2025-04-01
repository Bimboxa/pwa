import {useState} from "react";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useRemoteToken from "../hooks/useRemoteToken";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import initRemoteListingContainerService from "../services/initRemoteListingContainerService";
import useRemoteServiceKey from "../hooks/useRemoteServiceKey";
import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

export default function ButtonCreateRemoteListing() {
  // state

  const [loading, setLoading] = useState(false);

  // data

  const remoteToken = useRemoteToken();
  const {value: listing} = useSelectedListing();
  const serviceKey = useRemoteServiceKey();
  const {value: remoteProjectContainerProps} = useRemoteProjectContainerProps();

  console.log(
    "remoteProjectContainerProps",
    remoteProjectContainerProps,
    "listing",
    listing
  );

  // strings

  const label = "Synchroniser les données";

  // handlers

  async function handleClick() {
    if (loading) return;

    setLoading(true);
    const name = listing.entityModelKey + "::" + listing.id;
    const remoteListingContainer = await initRemoteListingContainerService({
      accessToken: remoteToken,
      serviceKey,
      remoteProjectContainerProps,
      name,
    });
    console.log("create remote listing", remoteListingContainer);
    setLoading(false);
  }

  return (
    <ButtonInPanel label={label} onClick={handleClick} loading={loading} />
  );
}
