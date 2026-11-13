import {
  Box,
  ButtonBase,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import Fullscreen from "@mui/icons-material/Fullscreen";

import ImageIndexBadge from "./ImageIndexBadge";
import SelectorPrintZoneSide from "./SelectorPrintZoneSide";
import { IMAGE_VEIL_RGBA } from "../constants/imageDisplay";

// ---------------------------------------------------------------------------
// TileImageAnnotation — one photo of the PopperImages grid: square
// photo, numbered badge (top-left), optional caption (label). Selected →
// primary border + "Fullscreen" button (DialogImageViewer). Veiled (another
// image is selected) → translucent white veil. `fill`: the tile takes the
// size of its parent instead of being square (print zones tiles).
// `onSnapSideChange` (print zones): 4 small toggles show at the bottom while
// the tile is hovered — the edge the photo snaps to (`snapSide`, null =
// automatic).
// ---------------------------------------------------------------------------

const ACTION_SX = {
  p: 0.25,
  bgcolor: "rgba(0,0,0,0.5)",
  color: "#fff",
  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
};

export default function TileImageAnnotation({
  annotation,
  number,
  selected = false,
  veiled = false,
  fill = false,
  showNumber = true,
  snapSide = null,
  onSnapSideChange,
  onSelect,
  onFullscreen,
  registerEl,
}) {
  // strings

  const fullscreenS = "Afficher en grand";

  // data

  const { image, label } = annotation;
  // Full image (blob URL): the stored thumbnail is far too small for a
  // 2-column tile and renders blurry.
  const src = image?.imageUrlClient ?? image?.thumbnail;

  // render

  return (
    <Box
      ref={(el) => registerEl?.(annotation.id, el)}
      sx={{
        position: "relative",
        minWidth: 0,
        ...(fill && { height: 1 }),
        "&:hover .tileImageSnapSide": { opacity: 1 },
      }}
    >
      <ButtonBase
        onClick={() => onSelect?.(annotation)}
        sx={{
          display: "block",
          width: 1,
          ...(fill ? { height: 1 } : { aspectRatio: "1 / 1" }),
          borderRadius: 1,
          overflow: "hidden",
          border: "2px solid",
          borderColor: selected ? "primary.main" : "divider",
          bgcolor: "action.hover",
        }}
      >
        {src && (
          <Box
            component="img"
            src={src}
            alt={label || ""}
            draggable={false}
            sx={{
              width: 1,
              height: 1,
              objectFit: "cover",
              display: "block",
              transform: annotation.imageFlipY ? "scaleY(-1)" : undefined,
            }}
          />
        )}
        {label && (
          <Typography
            variant="caption"
            noWrap
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              px: 0.75,
              py: 0.25,
              textAlign: "left",
              color: "#fff",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0))",
            }}
          >
            {label}
          </Typography>
        )}
        {veiled && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: IMAGE_VEIL_RGBA,
              pointerEvents: "none",
            }}
          />
        )}
      </ButtonBase>

      {showNumber && (
        <ImageIndexBadge
          number={number}
          dimmed={veiled}
          sx={{ position: "absolute", top: 6, left: 6 }}
        />
      )}

      <Box
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "flex",
          gap: 0.5,
        }}
      >
        {selected && (
          <Tooltip title={fullscreenS} arrow placement="bottom">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onFullscreen?.(annotation);
              }}
              sx={ACTION_SX}
            >
              <Fullscreen sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {onSnapSideChange && (
        <Box
          className="tileImageSnapSide"
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 6,
            display: "flex",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.1s ease",
            pointerEvents: "none",
          }}
        >
          <SelectorPrintZoneSide
            value={snapSide}
            onChange={(side) => onSnapSideChange(annotation, side)}
            sx={{ pointerEvents: "auto" }}
          />
        </Box>
      )}
    </Box>
  );
}
