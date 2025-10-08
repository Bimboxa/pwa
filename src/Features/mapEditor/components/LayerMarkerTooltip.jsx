import { useState, useEffect } from "react";
import { Box, Paper, Typography, Stack } from "@mui/material";

export default function LayerMarkerTooltip({
  containerEl,
  hoveredMarker,
  mousePos,
  annotationSpriteImage,
}) {
  // strings

  const noAdditionalInfoS = "Aucune information supplémentaire";

  // state

  const [size, setSize] = useState({ width: 0, height: 0 });

  // Update container size
  useEffect(() => {
    if (!containerEl) return;

    const updateSize = () => {
      const rect = containerEl.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [containerEl]);

  // Don't show if no marker
  if (!hoveredMarker) {
    return null;
  }

  const imageUrl = hoveredMarker.entity?.image?.imageUrlClient;
  const hasImage = Boolean(imageUrl);
  const hasDescription = Boolean(
    hoveredMarker.entity?.text || hoveredMarker.entity?.description
  );

  const tooltipWidth = 250;
  const tooltipHeight = hasImage ? 200 : hasDescription ? 120 : 80;
  const offset = 20;

  let left = mousePos.x + offset;
  let top = mousePos.y - tooltipHeight - offset;

  // Adjust if would go off-screen - EXACT same logic as working version
  if (left + tooltipWidth > size.width) {
    left = mousePos.x - tooltipWidth - offset;
  }
  if (top < 0) {
    top = mousePos.y + offset;
  }

  // Get sprite icon data
  const getSpriteIcon = () => {
    if (!annotationSpriteImage || !hoveredMarker.iconKey) return null;

    const { iconKeys, columns, rows, tile, url } = annotationSpriteImage;
    const resolvedIndex = Math.max(
      0,
      iconKeys?.indexOf(hoveredMarker.iconKey) ?? 0
    );
    const row = Math.floor(resolvedIndex / (columns || 1));
    const col = columns ? resolvedIndex % columns : 0;
    const sheetW = (columns || 1) * (tile || 0);
    const sheetH = (rows || 1) * (tile || 0);

    return {
      url,
      viewBox: `${(col || 0) * (tile || 0)} ${(row || 0) * (tile || 0)} ${
        tile || 0
      } ${tile || 0}`,
      sheetW,
      sheetH,
    };
  };

  const spriteData = getSpriteIcon();

  return (
    <Paper
      elevation={8}
      sx={{
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
        height: `${tooltipHeight}px`,
        pointerEvents: "none",
        zIndex: 1000,
        overflow: "hidden",
        borderRadius: 2,
        p: 0,
      }}
    >
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        {/* Image (only if exists) */}
        {hasImage && (
          <Box
            component="img"
            src={imageUrl}
            alt="Entity image"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Header */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 40,
            backgroundColor: hasImage ? "rgba(255, 255, 255, 0.95)" : "white",
            backdropFilter: hasImage ? "blur(4px)" : "none",
            display: "flex",
            alignItems: "center",
            px: 1.5,
            zIndex: 1,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {spriteData && (
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: "50%",
                  backgroundColor: hoveredMarker.fillColor || "#f44336",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox={spriteData.viewBox}
                  style={{ pointerEvents: "none" }}
                >
                  <image
                    href={spriteData.url}
                    width={spriteData.sheetW}
                    height={spriteData.sheetH}
                    preserveAspectRatio="none"
                  />
                </svg>
              </Box>
            )}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              {hoveredMarker.entity?.num ? `#${hoveredMarker.entity.num}` : ""}{" "}
              {hoveredMarker?.label || "-?-"}
            </Typography>
          </Stack>
        </Box>

        {/* Description (only if no image or as overlay) */}
        {hasDescription && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: hasImage ? "rgba(255, 255, 255, 0.95)" : "white",
              backdropFilter: hasImage ? "blur(4px)" : "none",
              p: 1.5,
              zIndex: 1,
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              maxHeight: hasImage ? "60px" : "none",
              overflow: "hidden",
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                lineHeight: 1.4,
                display: hasImage ? "-webkit-box" : "block",
                WebkitLineClamp: hasImage ? 2 : "none",
                WebkitBoxOrient: hasImage ? "vertical" : "unset",
                overflow: hasImage ? "hidden" : "visible",
              }}
            >
              {hoveredMarker.entity?.text || hoveredMarker.entity?.description}
            </Typography>
          </Box>
        )}

        {/* Content area for no-image case */}
        {!hasImage && !hasDescription && (
          <Box
            sx={{
              position: "absolute",
              top: 40,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f5f5f5",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {noAdditionalInfoS}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
