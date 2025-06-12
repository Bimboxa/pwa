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
import PanelSelectorEntity from "Features/entities/components/PanelSelectorEntity";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function FieldEntityVariantGrid({
  value,
  onChange,
  entities,
  entitiesListing,
  label,
  size = 8,
  formContainerRef,
}) {
  // strings

  const selectS = "Sélectionner une entité";

  // state

  const [open, setOpen] = useState(false);

  // helpers - entities

  const entityById = getItemsByKey(entities, "id");

  // helpers

  const valueWithProps = entityById[value?.id];
  const valueLabel = valueWithProps?.label ?? "-?-";
  const bbox = formContainerRef?.current?.getBoundingClientRect();

  // helpers

  const selectedEntityId = value?.id;

  // handlers

  function handleSelectionChange(id) {
    // const newZones = {ids: zoneIds};
    onChange({id});
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
      {open && (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: bbox.left,
              width: bbox.width,
              bottom: 0,
              zIndex: 2000,
              bgcolor: "background.default",
            }}
          >
            <PanelSelectorEntity
              title={selectS}
              entities={entities}
              entitiesListing={entitiesListing}
              selectedEntityId={selectedEntityId}
              onSelectionChange={handleSelectionChange}
              onClose={handlePanelClose}
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
