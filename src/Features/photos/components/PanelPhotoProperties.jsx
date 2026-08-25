import { useDispatch, useSelector } from "react-redux";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedPhotoId } from "../photosSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { ArrowBack as Back, PhotoCamera } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import usePhotoById from "../hooks/usePhotoById";
import usePhotoImageUrl from "../hooks/usePhotoImageUrl";
import useListingById from "Features/listings/hooks/useListingById";

// ---------------------------------------------------------------------------
// PanelPhotoProperties — right-panel properties of the selected photo
// (selection item {type: "PHOTO", id}): the image full width first, then the
// photo's metadata (album, localization state).
// ---------------------------------------------------------------------------

export default function PanelPhotoProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Photo";
  const albumS = "Album";
  const localizedS = "Localisée sur le plan";
  const notLocalizedS = "Non localisée sur le plan";
  const rangeS = "Portée";

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const photoId = selectedItem?.type === "PHOTO" ? selectedItem.id : null;
  const photo = usePhotoById(photoId);
  const imageUrl = usePhotoImageUrl(photo?.image?.fileName);
  const album = useListingById(photo?.listingId);

  // handlers

  function handleBack() {
    dispatch(clearSelection());
    dispatch(setSelectedPhotoId(null));
  }

  // render

  if (!photo) return null;

  const isLocalized = Boolean(photo.point);

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <PhotoCamera fontSize="small" sx={{ mx: 1, color: "text.secondary" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
            {photo.name}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Image — full panel width */}
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt={photo.name}
            sx={{ width: 1, display: "block" }}
          />
        )}

        {/* Metadata */}
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {album && (
            <Typography variant="body2">
              <Box component="span" sx={{ color: "text.secondary" }}>
                {albumS} ·{" "}
              </Box>
              {album.name}
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{ color: isLocalized ? "success.main" : "warning.main" }}
          >
            {isLocalized ? localizedS : notLocalizedS}
          </Typography>
          {isLocalized && Number.isFinite(photo.radiusM) && (
            <Typography variant="body2">
              <Box component="span" sx={{ color: "text.secondary" }}>
                {rangeS} ·{" "}
              </Box>
              {photo.radiusM.toFixed(2)} m
            </Typography>
          )}
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
