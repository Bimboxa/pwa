import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedPhotoId } from "../photosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Typography } from "@mui/material";

import GridPhotos from "./GridPhotos";
import useProjectPhotos from "../hooks/useProjectPhotos";
import useListings from "Features/listings/hooks/useListings";

// ---------------------------------------------------------------------------
// SectionPopperPhotos — "Photos" content of the PopperMapListings toggle
// (Viewer module): each photo album of the project as a section (same header
// typography as the listing sections) over a 2-column grid of its photos.
// Clicking a photo selects it (photosSlice.selectedPhotoId).
// ---------------------------------------------------------------------------

export default function SectionPopperPhotos() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedPhotoId = useSelector((s) => s.photos.selectedPhotoId);

  const photos = useProjectPhotos({ projectId });
  const { value: albums } = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "PHOTO",
  });

  // helpers - photos grouped by album, albums without photos skipped

  const photosByListingId = useMemo(
    () =>
      photos.reduce((acc, p) => {
        (acc[p.listingId] ??= []).push(p);
        return acc;
      }, {}),
    [photos]
  );

  const displayedAlbums = (albums ?? []).filter(
    (album) => photosByListingId[album.id]?.length > 0
  );

  // handlers

  function handlePhotoClick(photo) {
    dispatch(setSelectedPhotoId(photo.id));
    // Selection slice + right panel: the photo gets its dedicated
    // properties panel (PanelPhotoProperties).
    dispatch(setSelectedItem({ id: photo.id, type: "PHOTO" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  return (
    <>
      {displayedAlbums.map((album) => {
        const albumPhotos = photosByListingId[album.id];
        return (
          <Box key={album.id}>
            {/* Same typography as the listing section headers. */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                px: 1,
                py: 0.75,
                bgcolor: "panel.sectionBg",
                borderBottom: "1px solid",
                borderColor: "panel.border",
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "panel.textPrimary", flex: 1 }}
              >
                {album.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "panel.textMuted", fontWeight: 600 }}
              >
                {albumPhotos.length}
              </Typography>
            </Box>
            <GridPhotos
              photos={albumPhotos}
              selectedPhotoId={selectedPhotoId}
              onPhotoClick={handlePhotoClick}
              columns={2}
            />
          </Box>
        );
      })}
    </>
  );
}
