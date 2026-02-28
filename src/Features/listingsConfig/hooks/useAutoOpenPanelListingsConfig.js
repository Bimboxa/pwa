import {useEffect} from "react";
import {useDispatch} from "react-redux";
import {setOpenPanel} from "../listingsConfigSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useListings from "Features/listings/hooks/useListings";

export default function useAutoOpenPanelListingsConfig() {
  const dispatch = useDispatch();
  const {value: scope} = useSelectedScope();
  const {value: listings} = useListings({filterByScopeId: scope?.id});

  useEffect(() => {
    const shouldOpen = !listings?.length > 0;
    if (shouldOpen && scope?.id) {
      dispatch(setOpenPanel(true));
    }
  }, [scope?.id, listings?.length]);
}
