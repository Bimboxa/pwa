import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import db from "App/db/db";

import { Box, Typography, IconButton, InputBase } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import IconButtonMoreActionsBaseMapListing from "./IconButtonMoreActionsBaseMapListing";

export default function PanelBaseMapListingProperties({ listing }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Groupe de fonds de plan";
  const nameS = "Nom du groupe";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: baseMaps } = useBaseMaps({ filterByListingId: listing?.id });
  const { guardEditRecord } = useCanEditRecord();

  // state

  const [nameValue, setNameValue] = useState(null);

  // helpers

  const isEditingName = nameValue !== null;
  const displayName = isEditingName ? nameValue : listing?.name || "";

  const baseMapsCount = baseMaps?.length ?? 0;
  const countS = `${baseMapsCount} fond${baseMapsCount > 1 ? "s" : ""} de plan`;

  // handlers

  function handleBack() {
    // Back from the group properties returns to the scope panel, like the
    // baseMap properties panel.
    dispatch(setSelectedItem({ id: selectedScopeId, type: "SCOPE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
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
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
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

        <IconButtonMoreActionsBaseMapListing listing={listing} />
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
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
