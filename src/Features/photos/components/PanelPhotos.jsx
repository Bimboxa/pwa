import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedPhotoListingId,
  setSelectedPhotoId,
  setDetailPhotoId,
  setLocalizingPhotoId,
} from "../photosSlice";

import { Box, Typography } from "@mui/material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import ContainerFilesSelectorV2 from "Features/files/components/ContainerFilesSelectorV2";
import FieldActivePhotoAlbum from "./FieldActivePhotoAlbum";
import GridPhotos from "./GridPhotos";
import PanelPhotoDetail from "./PanelPhotoDetail";

import useListings from "Features/listings/hooks/useListings";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import usePhotos from "../hooks/usePhotos";
import useAddPhotosToAlbum from "../hooks/useAddPhotosToAlbum";

// ---------------------------------------------------------------------------
// PanelPhotos — left panel of the Photos module (#313): album selector,
// upload drop zone and the 3-column photo grid; clicking a photo opens the
// detail subview (large image + prev / next arrows + "Localiser la photo").
// Albums are PHOTO listings, project-level and scope-less (shared across
// scopes like baseMaps listings).
// ---------------------------------------------------------------------------

export default function PanelPhotos() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Photos";
  const descriptionS =
    "Ajoutez des photos à un album et localisez-les sur le plan : " +
    "position, direction et portée de la prise de vue.";
  const dropS = "Déposer ici des photos";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedListingId = useSelector((s) => s.photos.selectedListingId);
  const selectedPhotoId = useSelector((s) => s.photos.selectedPhotoId);
  const detailPhotoId = useSelector((s) => s.photos.detailPhotoId);
  const localizingPhotoId = useSelector((s) => s.photos.localizingPhotoId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const baseMap = useMainBaseMap();
  const addPhotosToAlbum = useAddPhotosToAlbum();

  const { value: listings } = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "PHOTO",
  });

  // state

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire on every child: keep a depth counter so the
  // overlay only closes when the pointer really leaves the panel.
  const dragDepthRef = useRef(0);

  // helpers - albums

  const albums = listings ?? [];
  const activeAlbum =
    albums.find((l) => l.id === selectedListingId) ?? albums[0] ?? null;

  const photos = usePhotos({ listingId: activeAlbum?.id });

  // helpers - detail (stale id resolves to nothing → the grid renders)

  const detailPhotoIndex = useMemo(
    () =>
      detailPhotoId ? photos.findIndex((p) => p.id === detailPhotoId) : -1,
    [photos, detailPhotoId]
  );

  // effect - leaving the PHOTO_POSE drawing mode (Escape, tool change,
  // commit) must clear the armed photo so the "Localiser" button re-enables.

  useEffect(() => {
    if (localizingPhotoId && enabledDrawingMode !== "PHOTO_POSE")
      dispatch(setLocalizingPhotoId(null));
  }, [localizingPhotoId, enabledDrawingMode, dispatch]);

  // effect - keep the album selection valid (deleted album, project change)

  useEffect(() => {
    if (selectedListingId && !albums.find((l) => l.id === selectedListingId))
      dispatch(setSelectedPhotoListingId(null));
  }, [albums, selectedListingId, dispatch]);

  // handlers

  async function handleFilesChange(files) {
    if (!files?.length || !activeAlbum) return;
    setUploading(true);
    try {
      await addPhotosToAlbum({
        files,
        projectId,
        listingId: activeAlbum.id,
        baseMapId: baseMap?.id ?? null,
      });
    } finally {
      setUploading(false);
    }
  }

  function handlePhotoClick(photo) {
    dispatch(setSelectedPhotoId(photo.id));
    dispatch(setDetailPhotoId(photo.id));
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragging(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    handleFilesChange([...(e.dataTransfer?.files ?? [])]);
  }

  // render - detail subview

  if (detailPhotoIndex !== -1) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: 1,
          minHeight: 0,
          bgcolor: "background.default",
          borderRight: "1px solid",
          borderColor: "divider",
        }}
      >
        <PanelPhotoDetail photos={photos} photoIndex={detailPhotoIndex} />
      </Box>
    );
  }

  // render - root view

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      <LeftDrawerPanelHeader title={titleS} />
      <Typography
        variant="caption"
        sx={{ px: 2, pb: 1, color: "text.secondary" }}
      >
        {descriptionS}
      </Typography>

      <FieldActivePhotoAlbum albums={albums} activeAlbum={activeAlbum} />

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 1 }}>
        {activeAlbum && photos.length > 0 && (
          <GridPhotos
            photos={photos}
            selectedPhotoId={selectedPhotoId}
            onPhotoClick={handlePhotoClick}
          />
        )}
        {activeAlbum && (
          <Box sx={{ p: 1, minHeight: 120, opacity: dragging ? 0.6 : 1 }}>
            <ContainerFilesSelectorV2
              callToActionLabel={dropS}
              accept="image/*"
              multiple
              onFilesChange={handleFilesChange}
              loading={uploading}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
