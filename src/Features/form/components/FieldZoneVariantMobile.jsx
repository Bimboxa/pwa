import {useState} from "react";

import {
  Box,
  ClickAwayListener,
  Grid2,
  IconButton,
  Typography,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import PanelSelectorZone from "Features/zones/components/PanelSelectorZone";
import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import getNodeById from "Features/tree/utils/getNodeById";

export default function FieldZoneVariantMobile({
  value,
  onChange,
  zonesTree,
  zonesListing,
  label,
  size = 8,
  formContainerRef,
}) {
  // helpers

  //const selection = value?.id ? [value.id] : [];
  const selection = value?.id ?? [];

  // handlers

  function handleChange(id) {
    const newZone = {id};
    onChange(newZone);
  }

  return (
    <PanelSelectorZone
      zonesListing={zonesListing}
      zonesTree={zonesTree}
      selection={selection}
      onSelectionChange={handleChange}
      multiSelect={false}
    />
  );
}
