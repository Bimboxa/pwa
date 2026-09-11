import { useDispatch } from "react-redux";

import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import { Box, Paper, Typography } from "@mui/material";

import BaseMapAnnotationsSvg from "./BaseMapAnnotationsSvg";

import getPageDimensions from "Features/portfolioEditor/utils/getPageDimensions";

// A3 landscape, the sheet the drawings are meant for.
const A3 = getPageDimensions("A3", "landscape");
const A3_LANDSCAPE_RATIO = A3.width / A3.height;

// Faded enough that the drawings carry the page, present enough to place them.
const IMAGE_OPACITY = 0.2;

// One base map of the SCOPE recap in image mode: the plan on a sheet-shaped
// card, its image dimmed and desaturated so the annotations stand out. Click
// opens it in the drawing editor.
export default function SectionBaseMapCard({
  baseMap,
  annotations = [],
  // Annotation listing the Dessin module narrows to (null = every listing).
  returnListingId = null,
}) {
  const dispatch = useDispatch();

  // handlers

  function handleClick() {
    dispatch(
      setViewerReturnContext({
        fromViewer: "SCOPE",
        listingId: returnListingId,
      })
    );
    if (returnListingId) {
      dispatch(setSelectedListingId(returnListingId));
    }
    dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setSelectedViewerKey("MAP"));
  }

  // render

  return (
    <Box>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        noWrap
        sx={{ mb: 0.5 }}
      >
        {baseMap.name}
      </Typography>
      <Paper
        variant="outlined"
        onClick={handleClick}
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "common.white",
          cursor: "pointer",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          "&:hover": {
            borderColor: "primary.main",
            boxShadow: 2,
          },
        }}
      >
        <BaseMapAnnotationsSvg
          baseMap={baseMap}
          annotations={annotations}
          aspectRatio={A3_LANDSCAPE_RATIO}
          imageOpacity={IMAGE_OPACITY}
          grayScale
        />
      </Paper>
    </Box>
  );
}
