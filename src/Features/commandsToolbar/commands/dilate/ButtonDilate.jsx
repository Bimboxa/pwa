import { useState } from "react";

import { Box, IconButton, Popover, Tooltip } from "@mui/material";
import { Add as AddIcon, Remove as RemoveIcon } from "@mui/icons-material";

import db from "App/db/db";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";

import CommandButton from "../../components/CommandButton";
import { getDilateTargets } from "./dilateCommand";

export default function ButtonDilate({ command, ctx, state, hotkeyLabel }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handlers

  function handleClick(event, anchor) {
    setAnchorEl(anchorEl ? null : anchor);
  }

  async function handleOffset(distance) {
    const targets = getDilateTargets(ctx).filter((a) => a?.points?.length);
    if (targets.length === 0) return;

    // annotation.points are reference pixel coords (useAnnotationsV2)
    const baseMap = ctx.baseMap;
    const refImageSize = baseMap?.getImageSize?.();
    const activeImageSize = baseMap?.getActiveImageSize?.();
    if (!refImageSize || !activeImageSize) return;
    const { width: refW, height: refH } = refImageSize;
    // 1 active pixel expressed in reference pixels
    const scale = refW / activeImageSize.width;

    const allNewPoints = [];
    for (const annotation of targets) {
      const offsetPoints = offsetPolygon(annotation.points, distance * scale);
      if (!offsetPoints?.length) continue;
      const newPoints = offsetPoints.map((p, i) => ({
        ...(annotation.points[i] || {}),
        x: p.x / refW,
        y: p.y / refH,
      }));
      await db.annotations.update(annotation.id, { points: newPoints });
      allNewPoints.push(...newPoints);
    }

    // db.points entries win over inline values at read time (resolvePoints)
    const pointIds = allNewPoints.map((p) => p.id).filter(Boolean);
    if (pointIds.length === 0) return;
    const existing = await db.points.where("id").anyOf(pointIds).toArray();
    if (existing.length === 0) return;
    const byId = Object.fromEntries(existing.map((p) => [p.id, p]));
    await db.points.bulkPut(
      allNewPoints
        .filter((p) => byId[p.id])
        .map((p) => ({ ...byId[p.id], x: p.x, y: p.y }))
    );
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, p: 0.5 }}>
          <Tooltip title="Contracter (-1px)">
            <IconButton size="small" onClick={() => handleOffset(-1)}>
              <RemoveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dilater (+1px)">
            <IconButton size="small" onClick={() => handleOffset(1)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Popover>
    </>
  );
}
