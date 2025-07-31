import { useState } from "react";

import {
  Box,
  ClickAwayListener,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import { ArrowForwardIos as Forward } from "@mui/icons-material";

import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import { get } from "firebase/database";
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

  console.log("nomenclature", nomenclature);
  const items = nomenclature?.items || [];

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const bbox = formContainerRef?.current?.getBoundingClientRect();

  // helpers

  const selection = value?.id ? [value.id] : [];
  const node = getNodeById(value?.id, nomenclature?.items);

  const nomenclatureName = nomenclature?.name ?? "-?-";
  const valueLabel = value?.id ? node.label : nomenclatureName;

  // handlers

  function handleChange(id) {
    console.log("[FieldCategoryVariantGrid] handleChange", id);
    const newZones = { id };
    onChange(newZones);
    setOpen(false);
  }

  function handleOpenSelector(e) {
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      {open && (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: bbox.left,
              width: bbox.width,
              bottom: 0,
              bgcolor: "background.paper",
              zIndex: 2000,
            }}
          >
            <SelectorVariantTree
              items={items}
              selection={selection}
              onChange={handleChange}
              multiSelect={false}
            />
          </Box>
        </ClickAwayListener>
      )}
      <Grid
        container
        sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
      >
        <Grid size={12 - size} sx={{ p: 1, bgcolor: "background.default" }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Grid>
        <Grid
          size={size}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {valueLabel}
          </Typography>
          <IconButton onClick={handleOpenSelector}>
            <Forward />
          </IconButton>
        </Grid>
      </Grid>
    </>
  );
}
