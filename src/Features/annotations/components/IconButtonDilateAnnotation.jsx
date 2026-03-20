import { useState } from "react";

import { Box, IconButton, Popover, Tooltip } from "@mui/material";
import { Add as AddIcon, Remove as RemoveIcon } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
import IconDilate from "./IconDilate";

import db from "App/db/db";

export default function IconButtonDilateAnnotation({ annotation, accentColor }) {
  // data

  const baseMap = useMainBaseMap();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const open = Boolean(anchorEl);

  // handlers

  function handleClick(event) {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleOffset(distance) {
    if (!annotation?.points?.length) return;

    // annotation.points are already in reference pixel coords (from useAnnotationsV2)
    const refImageSize = baseMap?.getImageSize?.();
    const activeImageSize = baseMap?.getActiveImageSize?.();
    if (!refImageSize || !activeImageSize) return;

    const { width: refW, height: refH } = refImageSize;
    const { width: activeW } = activeImageSize;

    // Scale factor: 1 active pixel expressed in reference pixels
    const scale = refW / activeW;

    // Apply offset in reference pixel space (distance * scale = 1 active px)
    const offsetPoints = offsetPolygon(annotation.points, distance * scale);
    if (!offsetPoints?.length) return;

    // Convert to normalized ratios for DB storage
    const newPoints = offsetPoints.map((p, i) => {
      const original = annotation.points[i] || {};
      return {
        ...original,
        x: p.x / refW,
        y: p.y / refH,
      };
    });

    // Update annotation
    await db.annotations.update(annotation.id, { points: newPoints });

    // Also update db.points entries (resolvePoints prioritizes db.points)
    const pointIds = newPoints.map((p) => p.id).filter(Boolean);
    if (pointIds.length > 0) {
      const existingDbPoints = await db.points
        .where("id")
        .anyOf(pointIds)
        .toArray();
      if (existingDbPoints.length > 0) {
        const dbPointsById = Object.fromEntries(
          existingDbPoints.map((p) => [p.id, p])
        );
        const updates = newPoints
          .filter((p) => dbPointsById[p.id])
          .map((p) => ({ ...dbPointsById[p.id], x: p.x, y: p.y }));
        await db.points.bulkPut(updates);
      }
    }
  }

  // render

  const buttonSx = {
    color: "text.disabled",
    "&:hover": {
      color: accentColor,
      bgcolor: accentColor + "18",
    },
  };

  return (
    <>
      <Tooltip title="Dilater / Contracter">
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            color: open ? accentColor : "text.disabled",
            bgcolor: open ? accentColor + "18" : "transparent",
            "&:hover": {
              color: accentColor,
              bgcolor: accentColor + "18",
            },
          }}
        >
          <IconDilate fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5 } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, p: 0.5 }}>
          <Tooltip title="Contracter (-1px)">
            <IconButton size="small" onClick={() => handleOffset(-1)} sx={buttonSx}>
              <RemoveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dilater (+1px)">
            <IconButton size="small" onClick={() => handleOffset(1)} sx={buttonSx}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Popover>
    </>
  );
}
