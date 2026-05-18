import { useState } from "react";

import { Box, IconButton, Popover, TextField, Tooltip } from "@mui/material";

import { nanoid } from "@reduxjs/toolkit";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import IconCloseWallFootprint from "./IconCloseWallFootprint";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import removeWallFootprint from "Features/geometry/utils/removeWallFootprint";

import db from "App/db/db";

const DEFAULT_WALL_CM = 20;

export default function IconButtonCloseWallFootprint({
  annotation,
  accentColor,
}) {
  // data

  const baseMap = useMainBaseMap();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [wallCm, setWallCm] = useState(DEFAULT_WALL_CM);

  // helpers

  const open = Boolean(anchorEl);

  // handlers

  function handleClick(event) {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleApply() {
    if (!annotation?.points?.length) return;

    const refImageSize = baseMap?.getImageSize?.();
    if (!refImageSize) return;
    const { width: refW, height: refH } = refImageSize;

    const meterByPx = baseMap?.getMeterByPx?.();

    // Points/cuts are already in reference pixel space (resolved by
    // useAnnotationsV2). Keep point ids on the outer ring — the contour
    // scanner resolves chains back through them.
    const pointsPx = annotation.points.map((p) => ({
      x: p.x,
      y: p.y,
      id: p.id,
    }));
    const cutsPx = (annotation.cuts ?? []).map((c) => ({
      points: (c.points ?? []).map((p) => ({ x: p.x, y: p.y })),
    }));

    const result = removeWallFootprint({
      pointsPx,
      cutsPx,
      meterByPx,
      wallCm,
    });
    if (!result) return;

    // Mint fresh point IDs and normalize for DB storage.
    const newDbPoints = [];
    const toRefs = (pts) =>
      pts.map((p) => {
        const id = nanoid();
        newDbPoints.push({
          id,
          x: p.x / refW,
          y: p.y / refH,
          projectId: annotation.projectId,
          baseMapId: annotation.baseMapId,
        });
        return { id };
      });

    const newPoints = toRefs(result.outerPx);
    const newCuts = result.cutsPx.map((c) => ({ points: toRefs(c.points) }));

    await db.transaction("rw", [db.annotations, db.points], async () => {
      if (newDbPoints.length > 0) await db.points.bulkAdd(newDbPoints);
      await db.annotations.update(annotation.id, {
        points: newPoints,
        cuts: newCuts,
      });
    });

    handleClose();
  }

  // render

  return (
    <>
      <Tooltip title="Retirer l'empreinte des murs">
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
          <IconCloseWallFootprint fontSize="small" />
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
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField
            type="number"
            size="small"
            label="Épaisseur des murs (cm)"
            value={wallCm}
            onChange={(e) => setWallCm(Number(e.target.value))}
            inputProps={{ min: 1, step: 1 }}
            sx={{ width: 180 }}
          />
          <ButtonInPanelV2 label="Appliquer" onClick={handleApply} />
        </Box>
      </Popover>
    </>
  );
}
