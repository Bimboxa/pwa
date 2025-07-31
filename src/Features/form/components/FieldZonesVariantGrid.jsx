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

export default function FieldZonesVariantGrid({
  value,
  onChange,
  zonesTree,
  zonesListing,
  label,
  size = 8,
  formContainerRef,
}) {
  zonesTree = zonesTree || [];
  console.log("[FieldZones] zonesTree", zonesTree);

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const valueLabel = value ? `${value?.ids.length} pièce(s)` : "Aucune zone";
  const bbox = formContainerRef?.current?.getBoundingClientRect();

  // helpers

  const selection = value?.ids ?? [];

  // handlers

  function handleChange(zoneIds) {
    const newZones = { ids: zoneIds };
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
              listing={zonesListing}
              items={zonesTree}
              selection={selection}
              onChange={handleChange}
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
