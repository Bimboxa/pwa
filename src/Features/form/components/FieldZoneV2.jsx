import { useState } from "react";

import {
  Box,
  ClickAwayListener,
  Grid,
  IconButton,
  Typography,
  ListItemButton,
} from "@mui/material";
import { ArrowForwardIos as Forward, ArrowDropDown } from "@mui/icons-material";

import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import PanelSelectorZone from "Features/zones/components/PanelSelectorZone";

import getNodeById from "Features/tree/utils/getNodeById";

export default function FieldZoneV2({
  value,
  onChange,
  zonesTree,
  zonesListing,
  label,
  size = 8,
  sectionContainerEl,
  options,
}) {
  zonesTree = zonesTree || [];

  // options

  const showAsSection = options.showAsSection;

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const node = getNodeById(value?.id, zonesTree);

  const valueLabel = node ? node.label : zonesListing?.name;
  const bbox = sectionContainerEl?.getBoundingClientRect();

  // helpers

  const selection = value?.id ?? [];

  // handlers

  function handleChange(zoneId) {
    onChange({ id: zoneId });
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
              left: 0,
              width: bbox.width,
              bottom: 0,
              bgcolor: "background.paper",
              zIndex: 1000,
            }}
          >
            <PanelSelectorZone
              zonesListing={zonesListing}
              zonesTree={zonesTree}
              selection={selection}
              onSelectionChange={handleChange}
              multiSelect={false}
              onClose={() => setOpen(false)}
            />
          </Box>
        </ClickAwayListener>
      )}

      {showAsSection && (
        <Box
          sx={{
            p: 1,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>
      )}
      <ListItemButton onClick={handleOpenSelector}>
        <Box>
          <Typography variant="body2">{valueLabel}</Typography>
        </Box>
        <ArrowDropDown color="action" />
      </ListItemButton>
    </>
  );
}
