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
import getNodeById from "Features/tree/utils/getNodeById";

export default function FieldZoneVariantGrid({
  value,
  onChange,
  zonesTree,
  label,
  size = 8,
  formContainerRef,
}) {
  zonesTree = zonesTree || [];

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const node = getNodeById(value?.id, zonesTree);
  console.log("debug_3005_ids", node, value?.id);

  const valueLabel = node ? node.label : "Aucune zone";
  const bbox = formContainerRef?.current?.getBoundingClientRect();

  // helpers

  const selection = value?.id ?? [];

  // handlers

  function handleChange(zoneId) {
    onChange({id: zoneId});
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
              items={zonesTree}
              selection={selection}
              onChange={handleChange}
              multiSelect={false}
            />
          </Box>
        </ClickAwayListener>
      )}
      <Grid2
        container
        sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}
      >
        <Grid2 size={12 - size} sx={{p: 1, bgcolor: "background.default"}}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Grid2>
        <Grid2
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
        </Grid2>
      </Grid2>
    </>
  );
}
