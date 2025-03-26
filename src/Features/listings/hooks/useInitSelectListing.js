import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import getInitListingId from "Features/init/services/getInitListingId";

export default function useInitSelectListing() {
  const dispatch = useDispatch();

  const initListingId = getInitListingId();

  useEffect(() => {
    dispatch(setSelectedListingId(initListingId));
  }, []);
}
