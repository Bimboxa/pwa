import {useState} from "react";
import {useSelector} from "react-redux";
import useRemoteProjectSyncData from "./useRemoteProjectSyncData";

export default function useRemoteListingSyncData() {
  const [loading, setLoading] = useState(false);

  const {value: projectSyncData, loading: loadingRemoteProjectSyncData} =
    useRemoteProjectSyncData();

  const listingId = useSelector((s) => s.listings.selectedListingId);

  const listingSyncData = projectSyncData?.listingsById[listingId];

  return {
    value: listingSyncData,
    loading: loading || loadingRemoteProjectSyncData,
  };
}
