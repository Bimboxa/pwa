import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Paper, Box, Divider, Typography, IconButton } from "@mui/material";
import { ArrowDropDown as Down, ArrowDropUp as Up } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonEnhanceBaseMap from "Features/baseMaps/components/ButtonEnhanceBaseMap";
import ButtonRemoveText from "./ButtonRemoveText";
import ButtonRemoveColoredContent from "./ButtonRemoveColoredContent";
import ButtonToggleShowEnhanced from "./ButtonToggleShowEnhanced";

import getPolylinesFromContours from "Features/annotations/utils/getPolylinesFromContours";

import cv from "../services/opencvService";
import theme from "Styles/theme";

export default function PanelOpencv() {
  const dispatch = useDispatch();
  // strings

  const title = "Traitement d'image";
  const contoursS = "Détecter les contours";

  // state

  const [open, setOpen] = useState(true);

  // data

  const { value: listing } = useSelectedListing();
  const maskImageUrl = useSelector((s) => s.opencv.maskImageUrl);

  // helpers

  const em = listing?.entityModel?.type;
  console.log("em", em);

  // handlers

  async function detectContours() {
    dispatch(setEnabledDrawingMode("OPENCV"));
  }

  return (
    <Paper>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((open) => !open)}>
          {open ? <Up fontSize="small" /> : <Down fontSize="small" />}
        </IconButton>
      </Box>
      {open && (
        <BoxFlexVStretch sx={{ p: 1 }}>
          {em === "LOCATED_ENTITY" && (
            <ButtonGeneric
              onClick={detectContours}
              label={contoursS}
              variant="contained"
              color="secondary"
            />
          )}

          {em === "BASE_MAP" && (
            <>
              <ButtonEnhanceBaseMap />
              <ButtonRemoveText />
              <ButtonRemoveColoredContent />
            </>
          )}

          {maskImageUrl && (
            <Box
              component="img"
              src={maskImageUrl}
              alt="OpenCV mask preview"
              sx={{
                width: "100%",
                maxWidth: 280,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                mt: 2,
              }}
            />
          )}
          <Divider sx={{ my: 1 }} />
          <ButtonToggleShowEnhanced />
        </BoxFlexVStretch>
      )}
    </Paper>
  );
}
