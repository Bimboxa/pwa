import { useState } from "react";

import {
  Box,
  ClickAwayListener,
  Grid,
  IconButton,
  Typography,
  Button,
  ListItemButton,
} from "@mui/material";
import { ArrowDropDown, ArrowForwardIos as Forward } from "@mui/icons-material";

import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import { get } from "firebase/database";
import getNodeById from "Features/tree/utils/getNodeById";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import getNomenclatureItemLabels from "Features/nomenclatures/utils/getNomenclatureItemLabels";

export default function FieldCategoryV2({
  value,
  onChange,
  nomenclature,
  label,
  size = 8,
  sectionContainerEl,
  options,
}) {
  // options

  const showAsSection = options?.showAsSection;

  // helpers

  console.log("debug_1211_nomenclature", nomenclature);
  const items = nomenclature?.items || [];

  // state

  const [open, setOpen] = useState(false);

  // helpers
  const el = sectionContainerEl ?? null;
  const bbox = el?.getBoundingClientRect();

  // helpers

  const selection = value?.id ? [value.id] : [];
  const node = getNodeById(value?.id, nomenclature?.items);

  const nomenclatureName = nomenclature?.name ?? "-?-";
  const valueLabel = value?.id ? node.label : nomenclatureName;

  const labels = getNomenclatureItemLabels(value?.id, nomenclature);

  // handlers

  function handleChange(id) {
    console.log("[FieldCategoryV2] handleChange", id);
    const newCategory = { id, nomenclatureId: nomenclature?.listingId };
    onChange(newCategory);
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
              width: bbox?.width,
              bottom: 0,
              bgcolor: "background.paper",
              zIndex: 2000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <BoxFlexVStretch>
              <HeaderTitleClose title={label} onClose={() => setOpen(false)} />
              <BoxFlexVStretch>
                <SelectorVariantTree
                  items={items}
                  selection={selection}
                  onChange={handleChange}
                  multiSelect={false}
                />
              </BoxFlexVStretch>
            </BoxFlexVStretch>
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
      <ListItemButton
        onClick={handleOpenSelector}
        sx={{ mb: showAsSection ? 1 : 0 }}
      >
        <Box>
          {labels?.contextLabel && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {labels?.contextLabel}
            </Typography>
          )}
          <Typography variant="body2">{labels?.label}</Typography>
        </Box>
        <ArrowDropDown color="action" />
      </ListItemButton>
    </>
  );
}
