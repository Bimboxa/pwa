import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setTempListings} from "../listingsConfigSlice";

import Panel from "Features/layout/components/Panel";

import {Box} from "@mui/material";
import {createPortal} from "react-dom";
import PanelTempListings from "./PanelTempListings";
import SectionCreateFromPreset from "./SectionCreateFromPreset";
import ScreenGeneric from "Features/layout/components/ScreenGeneric";

export default function PanelListingsConfig({containerEl}) {
  const dispatch = useDispatch();
  // data

  const tempListings = useSelector((s) => s.listingsConfig.tempListings);

  // helpers

  const open = tempListings?.length > 0;

  // handlers

  function handleClose() {
    dispatch(setTempListings([]));
  }

  return (
    <Panel>
      <SectionCreateFromPreset />
      {open &&
        createPortal(
          <ScreenGeneric
            onClose={handleClose}
            open={open}
            sx={{position: "absolute", zIndex: 1, bgcolor: "white"}}
          >
            <PanelTempListings />
          </ScreenGeneric>,
          containerEl
        )}
    </Panel>
  );
}
