import {useState} from "react";

import {
  Box,
  ClickAwayListener,
  Grid2,
  IconButton,
  Typography,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import {get} from "firebase/database";
import getNodeById from "Features/tree/utils/getNodeById";

export default function FieldZoneVariantMobile({
  value,
  onChange,
  zonesTree,
  label,
  size = 8,
  formContainerRef,
}) {
  // helpers

  const items = zonesTree || [];

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const selection = value?.id ? [value.id] : [];
  const node = getNodeById(value?.id, zonesTree);

  const valueLabel = value?.id ? node?.label : "Aucune catégorie";

  // handlers

  function handleChange(id) {
    const newZone = {id};
    onChange(newZone);
    setOpen(false);
  }

  function handleOpenSelector(e) {
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <SelectorVariantTree
      items={items}
      selection={selection}
      onChange={handleChange}
      multiSelect={false}
    />
  );
}
