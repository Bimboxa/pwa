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

export default function FieldTreeItemsVariantMobile({
  value,
  onChange,
  tree,
  label,
  size = 8,
  formContainerRef,
}) {
  // state

  const [open, setOpen] = useState(false);

  // helpers

  const bbox = formContainerRef?.current?.getBoundingClientRect();

  // helpers

  const selection = value ?? [];

  // handlers

  function handleChange(ids) {
    console.log("[FieldTreeItems] handleChange", ids);
    onChange(ids);
    setOpen(false);
  }

  function handleOpenSelector(e) {
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <SelectorVariantTree
      items={tree ?? []}
      selection={selection}
      onChange={handleChange}
      multiSelect={true}
    />
  );
}
