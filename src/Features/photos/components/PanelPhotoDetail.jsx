import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  setDetailPhotoId,
  setSelectedPhotoId,
  setLocalizingPhotoId,
} from "../photosSlice";

import { Box, Button, IconButton, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import PinDrop from "@mui/icons-material/PinDrop";

import usePhotoImageUrl from "../hooks/usePhotoImageUrl";
import useDeletePhoto from "../hooks/useDeletePhoto";

// ---------------------------------------------------------------------------
// PanelPhotoDetail — detail subview of the Photos panel: one photo displayed
// large (panel width), prev / next arrows in the header to browse the album
// (PanelAnnotationDetail pattern), "Localiser la photo" arms the PHOTO_POSE
// 2-click tool on the map.
// ---------------------------------------------------------------------------

export default function PanelPhotoDetail({ photos, photoIndex }) {
  const dispatch = useDispatch();

  // strings

  const localizeS = "Localiser la photo";
  const relocalizeS = "Re-localiser la photo";
  const localizingS = "Cliquez sur le plan : 1er clic = position, 2ème clic = direction et portée.";

  // data

  const localizingPhotoId = useSelector((s) => s.photos.localizingPhotoId);
  const deletePhoto = useDeletePhoto();

  // helpers

  const photo = photos[photoIndex];
  const imageUrl = usePhotoImageUrl(photo?.image?.fileName);
  const prevPhoto = photoIndex > 0 ? photos[photoIndex - 1] : null;
  const nextPhoto =
    photoIndex < photos.length - 1 ? photos[photoIndex + 1] : null;
  const isLocalizing = localizingPhotoId === photo?.id;

  // handlers

  function handleBack() {
    dispatch(setDetailPhotoId(null));
  }

  function handleGoTo(target) {
    if (!target) return;
    dispatch(setDetailPhotoId(target.id));
    dispatch(setSelectedPhotoId(target.id));
  }

  function handleLocalize() {
    dispatch(setLocalizingPhotoId(photo.id));
    dispatch(setEnabledDrawingMode("PHOTO_POSE"));
  }

  async function handleDelete() {
    const target = photo;
    dispatch(setDetailPhotoId(null));
    dispatch(setSelectedPhotoId(null));
    await deletePhoto(target);
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
      }}
    >
      {/* header: back + counter + prev / next */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <IconButton size="small" onClick={handleBack}>
          <ArrowBack sx={{ fontSize: 18 }} />
        </IconButton>
        <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 600 }}>
          {photo?.name}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {photoIndex + 1}/{photos.length}
        </Typography>
        <IconButton
          size="small"
          disabled={!prevPhoto}
          onClick={() => handleGoTo(prevPhoto)}
        >
          <ChevronLeft sx={{ fontSize: 20 }} />
        </IconButton>
        <IconButton
          size="small"
          disabled={!nextPhoto}
          onClick={() => handleGoTo(nextPhoto)}
        >
          <ChevronRight sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* image */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt={photo?.name}
            sx={{ width: 1, display: "block" }}
          />
        )}

        {/* actions */}
        <Box
          sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}
        >
          <Button
            variant="contained"
            startIcon={<PinDrop />}
            onClick={handleLocalize}
            disabled={isLocalizing}
          >
            {photo?.point ? relocalizeS : localizeS}
          </Button>
          {isLocalizing && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {localizingS}
            </Typography>
          )}
          <Button
            color="error"
            startIcon={<DeleteOutline />}
            onClick={handleDelete}
          >
            Supprimer
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
