import { useRef, useState, useEffect, useMemo } from "react";
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

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
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

  // state

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // helpers

  const imageUrl = baseMap.getUrl?.() || baseMap.getThumbnail?.();
  const imageSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  const meterByPx = baseMap.getMeterByPx?.();
  const imageWidth = imageSize?.width;
  const imageHeight = imageSize?.height;
  const containerK = imageWidth && containerWidth ? containerWidth / imageWidth : 1;

  const nonLabelAnnotations = useMemo(
    () => annotations?.filter((a) => a.type !== "LABEL") ?? [],
    [annotations]
  );
  const labelAnnotations = useMemo(
    () => annotations?.filter((a) => a.type === "LABEL") ?? [],
    [annotations]
  );

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
      <Box ref={containerRef} sx={{ width: "40%", flexShrink: 0 }}>
        {imageUrl && imageSize ? (
          <Box sx={{ position: "relative" }}>
            <svg
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              width="100%"
              style={{
                display: "block",
                borderRadius: 4,
                backgroundColor: "#f5f5f5",
                cursor: "pointer",
              }}
              preserveAspectRatio="xMidYMid meet"
              onClick={handleSvgClick}
            >
              <NodeSvgImage
                src={imageUrl}
                width={imageWidth}
                height={imageHeight}
              />
              {containerWidth > 0 &&
                nonLabelAnnotations.map((annotation) => (
                  <NodeAnnotationStatic
                    key={annotation.id}
                    annotation={annotation}
                    imageSize={imageSize}
                    baseMapMeterByPx={meterByPx}
                    containerK={containerK}
                    printMode
                  />
                ))}
            </svg>
            {/* Labels in separate overflow-visible SVG */}
            {containerWidth > 0 && labelAnnotations.length > 0 && (
              <svg
                viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                width="100%"
                style={{
                  display: "block",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  pointerEvents: "none",
                  overflow: "visible",
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                {labelAnnotations.map((annotation) => (
                  <NodeAnnotationStatic
                    key={annotation.id}
                    annotation={annotation}
                    imageSize={imageSize}
                    baseMapMeterByPx={meterByPx}
                    containerK={containerK}
                    printMode
                  />
                ))}
              </svg>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              width: 1,
              minHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "grey.100",
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No image
            </Typography>
          </Box>
        )}
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
