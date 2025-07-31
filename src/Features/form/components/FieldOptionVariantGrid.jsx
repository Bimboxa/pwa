import { useState } from "react";
import { createPortal } from "react-dom";

import {
  Box,
  Button,
  ClickAwayListener,
  Grid,
  IconButton,
  Typography,
} from "@mui/material";
import {
  ArrowForwardIos as Forward,
  ArrowDropDown as Down,
} from "@mui/icons-material";
import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import PanelSelectorEntity from "Features/entities/components/PanelSelectorEntity";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function FieldOptionVariantGrid({
  value,
  onChange,
  valueOptions,
  label,
  size = 8,
  formContainerRef,
}) {
  // string

  const selectS = "";

  // state

  const [open, setOpen] = useState(false);

  // helpers - entities

  const optionsByKey = getItemsByKey(valueOptions, "key");

  // helpers

  const valueLabel = value?.label ?? selectS;

  // helpers

  const selectedEntityId = value?.key;

  // helpers - entities

  const entities = valueOptions.map((option) => ({
    ...option,
    id: option.key,
  }));

  // handlers

  function handleSelectionChange(id) {
    console.log("SelectionChange", id);
    const option = optionsByKey[id];
    onChange(option);
    setOpen(false);
  }

  function handleOpenSelector(e) {
    e.stopPropagation();
    setOpen(true);
  }

  function handlePanelClose() {
    setOpen(false);
  }

  return (
    <>
      {open &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              bgcolor: "white",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PanelSelectorEntity
              entities={entities}
              selectedEntityId={selectedEntityId}
              onSelectionChange={handleSelectionChange}
              onClose={handlePanelClose}
              title={label}
            />
          </Box>,
          formContainerRef.current
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
        <Grid size={size}>
          <Button
            variant="text"
            fullWidth
            onClick={handleOpenSelector}
            endIcon={<Down />}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ width: 1 }}
            >
              {valueLabel}
            </Typography>
          </Button>
        </Grid>
      </Grid>
    </>
  );
}
