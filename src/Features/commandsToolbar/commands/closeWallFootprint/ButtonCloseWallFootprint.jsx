import { useState } from "react";

import { Box, Popover, TextField } from "@mui/material";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import removeWallFootprint from "Features/geometry/utils/removeWallFootprint";

import CommandButton from "../../components/CommandButton";

const DEFAULT_WALL_CM = 20;

export default function ButtonCloseWallFootprint({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [wallCm, setWallCm] = useState(DEFAULT_WALL_CM);
  const open = Boolean(anchorEl);

  // handlers

  function handleClick(event, anchor) {
    setAnchorEl(anchorEl ? null : anchor);
  }

  async function handleApply() {
    const annotation = ctx.selectedAnnotation;
    if (!annotation?.points?.length) return;
    const refImageSize = ctx.baseMap?.getImageSize?.();
    if (!refImageSize) return;
    const { width: refW, height: refH } = refImageSize;
    const meterByPx = ctx.baseMap?.getMeterByPx?.();

    // Points / cuts are in reference pixel space (useAnnotationsV2). Point ids
    // of the outer ring are kept: the contour scanner resolves chains by them.
    const pointsPx = annotation.points.map((p) => ({
      x: p.x,
      y: p.y,
      id: p.id,
    }));
    const cutsPx = (annotation.cuts ?? []).map((c) => ({
      points: (c.points ?? []).map((p) => ({ x: p.x, y: p.y })),
    }));
    const result = removeWallFootprint({ pointsPx, cutsPx, meterByPx, wallCm });
    if (!result) return;

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
    setAnchorEl(null);
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: open }}
        onClick={handleClick}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5 } } }}
      >
        <Box
          onKeyDown={(e) => {
            if (e.key !== "Escape") e.stopPropagation();
          }}
          sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
        >
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
