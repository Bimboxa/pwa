import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import useBusinessObjects from "../hooks/useBusinessObjects";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import db from "App/db/db";

import {
  Box,
  Checkbox,
  FormControlLabel,
  Typography,
  IconButton,
  InputBase,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// Right-panel properties of a business-objects listing, reached with the back
// arrow of the object properties panel (selection: {type: "LISTING"}). Name
// edition + the "Numérotation" display option (3-column DPGF-like tree).
export default function PanelBusinessObjectListingProperties({ listing }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Liste d'ouvrages";
  const nameS = "Nom de la liste";
  const numberingS = "Numérotation";
  const numberingCaptionS =
    "Affiche les ouvrages sur 3 colonnes : numéro, nom, quantité.";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: businessObjects } = useBusinessObjects({
    listingId: listing?.id,
  });
  const { guardEditRecord } = useCanEditRecord();

  // state

  const [nameValue, setNameValue] = useState(null);

  // helpers

  const isEditingName = nameValue !== null;
  const displayName = isEditingName ? nameValue : listing?.name || "";

  const objectsCount = businessObjects?.length ?? 0;
  const countS = `${objectsCount} ouvrage${objectsCount > 1 ? "s" : ""}`;

  // handlers

  function handleBack() {
    // Back from the listing properties returns to the scope panel, like the
    // baseMap group properties panel.
    dispatch(setSelectedItem({ id: selectedScopeId, type: "SCOPE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  async function handleToggleNumbering(e) {
    if (!listing?.id || !guardEditRecord(listing)) return;
    await db.listings.update(listing.id, {
      showNumbering: e.target.checked,
    });
    dispatch(triggerListingsUpdate());
  }

  // handlers - name

  function handleNameFocus() {
    setNameValue(listing?.name || "");
  }

  async function handleNameBlur() {
    if (nameValue !== null && listing?.id && guardEditRecord(listing)) {
      await db.listings.update(listing.id, { name: nameValue });
    }
    setNameValue(null);
  }

  function handleNameKeyDown(e) {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setNameValue(null);
    }
  }

  // render

  // useListingById spreads an undefined record into a truthy `{entityModel}`
  // object, and reads are not filtered on deletedAt: guard on both.
  if (!listing?.id || listing.deletedAt) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {titleS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {listing.name || titleS}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {countS}
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1.5 }}>
        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {nameS}
            </Typography>
            <InputBase
              value={displayName}
              onChange={(e) => setNameValue(e.target.value)}
              onFocus={handleNameFocus}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              fullWidth
              sx={{ fontSize: "0.875rem" }}
            />
          </Box>
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={Boolean(listing.showNumbering)}
                  onChange={handleToggleNumbering}
                />
              }
              label={
                <Typography variant="body2">{numberingS}</Typography>
              }
              sx={{ ml: 0 }}
            />
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {numberingCaptionS}
            </Typography>
          </Box>
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
