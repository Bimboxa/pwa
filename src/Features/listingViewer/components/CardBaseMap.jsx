import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import { Box, Card, CardMedia, CardContent, Typography, IconButton, Chip } from "@mui/material";
import { Add } from "@mui/icons-material";

import db from "App/db/db";

export default function CardBaseMap({ baseMap, listing }) {
  const dispatch = useDispatch();

  // state

  const [hovered, setHovered] = useState(false);

  // data

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const annotationCount = useLiveQuery(async () => {
    if (!baseMap?.id || !listing?.id) return 0;
    const annotations = await db.annotations
      .where("baseMapId")
      .equals(baseMap.id)
      .toArray();
    return annotations.filter(
      (a) => !a.deletedAt && a.listingId === listing.id && !a.isBaseMapAnnotation
    ).length;
  }, [baseMap?.id, listing?.id, annotationsUpdatedAt]);

  // helpers

  const imageUrl = baseMap.getUrl?.() || baseMap.getThumbnail?.();

  // handlers

  function handleOpenInMapViewer() {
    dispatch(
      setViewerReturnContext({
        fromViewer: "LISTING",
        listingId: listing.id,
      })
    );
    dispatch(setSelectedListingId(listing.id));
    dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setSelectedViewerKey("MAP"));
  }

  // render

  return (
    <Card
      variant="outlined"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        position: "relative",
        cursor: "default",
        transition: "box-shadow 0.15s ease",
        "&:hover": { boxShadow: 2 },
      }}
    >
      <Box sx={{ position: "relative", height: 160, bgcolor: "grey.100" }}>
        {imageUrl ? (
          <CardMedia
            component="img"
            image={imageUrl}
            alt={baseMap.name}
            sx={{ height: 160, objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              height: 160,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No image
            </Typography>
          </Box>
        )}

        {/* Hover button */}
        {hovered && (
          <IconButton
            size="small"
            onClick={handleOpenInMapViewer}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "primary.main",
              color: "white",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <Add />
          </IconButton>
        )}
      </Box>

      <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {baseMap.name}
          </Typography>
          {annotationCount > 0 && (
            <Chip
              label={annotationCount}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 1, minWidth: 28 }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
