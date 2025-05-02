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

export default function FieldCategoryVariantGrid({
  value,
  onChange,
  nomenclature,
  label,
  size = 8,
  formContainerRef,
}) {
  // helpers

  const items = nomenclature?.items || [];

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const bbox = formContainerRef?.current?.getBoundingClientRect();

  // helpers

  const selection = value?.id ? [value.id] : [];
  const node = getNodeById(value?.id, nomenclature?.items);

  const valueLabel = value?.id ? node.label : "Aucune catégorie";

  // handlers

  function handleChange(id) {
    console.log("[FieldCategoryVariantGrid] handleChange", id);
    const newZones = {id};
    onChange(newZones);
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
