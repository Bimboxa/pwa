import {useEffect} from "react";
import {useDispatch} from "react-redux";
import {setOpenPanel} from "../listingsConfigSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

export default function useAutoOpenPanelListingsConfig() {
  const dispatch = useDispatch();
  const {value: scope} = useSelectedScope();

  const sortedListings = scope?.sortedListings;
  console.log("sortedListings", scope);

  useEffect(() => {
    const shouldOpen = !sortedListings?.length > 0;
    if (shouldOpen && scope?.id) {
      dispatch(setOpenPanel(true));
    }
  }, [scope?.id]);
}
