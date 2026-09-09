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
import {
  setSelectedItem,
} from "Features/selection/selectionSlice";

import { Box, Typography, Button } from "@mui/material";

import BaseMapAnnotationsSvg from "./BaseMapAnnotationsSvg";
import SectionAnnotationTemplateQties from "./SectionAnnotationTemplateQties";
import SectionBusinessObjectQties from "./SectionBusinessObjectQties";

// One base map of the SCOPE module recap: its thumbnail with the annotations
// drawn on top, and beside it the quantities of that base map for the selected
// listing (see MainListingMapsEditor for the mode table).
export default function SectionBaseMap({
  baseMap,
  listing,
  annotationTemplates,
  annotations = [],
  showAllListings = false,
  isBaseMapListing = false,
  isBusinessObjectListing = false,
  businessObjects,
  businessObjectRels,
}) {
  const dispatch = useDispatch();

  // handlers

  function handleOpenInMapViewer() {
    dispatch(
      setViewerReturnContext({
        fromViewer: "SCOPE",
        listingId: showAllListings ? null : listing?.id,
      })
    );
    if (!showAllListings && listing?.id) {
      dispatch(setSelectedListingId(listing.id));
    }
    dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setSelectedViewerKey("MAP"));
  }

  function handleSvgClick() {
    // Click on empty area -> deselect
    dispatch(setSelectedItem(null));
  }

  // render

  return (
    <Box sx={{ width: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {baseMap.name}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, width: 1 }}>
      {/* BaseMap image with annotation overlay - 40% width */}
      <Box
        sx={{ width: "40%", flexShrink: 0, cursor: "pointer" }}
        onClick={handleSvgClick}
      >
        <BaseMapAnnotationsSvg baseMap={baseMap} annotations={annotations} />
      </Box>

      {/* Content - quantities */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          pl: "24px",
          pr: "24px",
        }}
      >
        {isBaseMapListing ? null : isBusinessObjectListing ? (
          <SectionBusinessObjectQties
            businessObjects={businessObjects}
            rels={businessObjectRels}
            annotations={annotations}
          />
        ) : (
          <SectionAnnotationTemplateQties
            annotations={annotations}
            annotationTemplates={annotationTemplates}
            groupByListing={showAllListings}
          />
        )}

        <Box sx={{ mt: "auto", pt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleOpenInMapViewer}
          >
            Modifier le repérage
          </Button>
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
