import {useSelector, useDispatch} from "react-redux";
import {useEffect} from "react";

import {setOpenPanelDownloadListingsData} from "../listingsConfigSlice";

import useListingsToDownload from "../hooks/useListingsToDownload";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelDownloadListingsData from "./PanelDownloadListingsData";

export default function DialogAutoDownloadListingsData() {
  const dispatch = useDispatch();
  // data

  const listingsToDownload = useListingsToDownload();
  const {value: scope} = useSelectedScope();

  console.log("listingsToDownload", listingsToDownload, scope?.sortedListings);

  // effect

  useEffect(() => {
    if (scope?.id && listingsToDownload?.length > 0) {
      dispatch(setOpenPanelDownloadListingsData(true));
    }
  }, [scope?.id, listingsToDownload?.length]);

  // helpers

  const open = useSelector(
    (s) => s.listingsConfig.openPanelDownloadListingsData
  );

  // handlers

  function handleClose() {
    dispatch(setOpenPanelDownloadListingsData(false));
  }
  return (
    <DialogGeneric open={open} onClose={handleClose}>
      <PanelDownloadListingsData />
    </DialogGeneric>
  );
}
