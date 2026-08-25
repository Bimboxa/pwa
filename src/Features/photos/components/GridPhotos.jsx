import { Box, ButtonBase, Tooltip } from "@mui/material";
import LocationOff from "@mui/icons-material/LocationOff";

// ---------------------------------------------------------------------------
// GridPhotos — 3-column grid of square photo thumbnails. Unlocalized photos
// (no pose on a base map yet) carry a corner badge. Thumbnails are the inline
// dataURL stored on the photo row.
// ---------------------------------------------------------------------------

export default function GridPhotos({ photos, selectedPhotoId, onPhotoClick }) {
  // strings

  const notLocalizedS = "Photo non localisée sur le plan";

  // render

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        px: 1.5,
        py: 1,
      }}
    >
      {photos.map((photo) => {
        const selected = photo.id === selectedPhotoId;
        return (
          <ButtonBase
            key={photo.id}
            onClick={() => onPhotoClick?.(photo)}
            sx={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 1,
              overflow: "hidden",
              border: "2px solid",
              borderColor: selected ? "primary.main" : "divider",
            }}
          >
            <Box
              component="img"
              src={photo.image?.thumbnail}
              alt={photo.name}
              sx={{ width: 1, height: 1, objectFit: "cover" }}
            />
            {!photo.point && (
              <Tooltip title={notLocalizedS}>
                <Box
                  sx={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    bgcolor: "rgba(0,0,0,0.55)",
                    color: "warning.light",
                  }}
                >
                  <LocationOff sx={{ fontSize: 13 }} />
                </Box>
              </Tooltip>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
