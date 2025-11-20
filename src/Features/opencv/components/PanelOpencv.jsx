import { useDispatch, useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Paper, Box } from "@mui/material";
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

  const contoursS = "Détecter les contours";

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
      <BoxFlexVStretch sx={{ p: 1 }}>
        <ButtonToggleShowEnhanced />
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
      </BoxFlexVStretch>
    </Paper>
  );
}
