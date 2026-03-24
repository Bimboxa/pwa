import { IconButton, Tooltip } from "@mui/material";
import { Healing as HealingIcon } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import repairAnnotationGeometry from "../utils/repairAnnotationGeometry";

import db from "App/db/db";

export default function IconButtonRepairAnnotation({
  annotation,
  accentColor,
}) {
  // data

  const baseMap = useMainBaseMap();

  // handlers

  async function handleClick() {
    if (!annotation?.points?.length) return;

    const result = repairAnnotationGeometry(annotation);
    if (!result) return;

    const { repairedPoints, repairedCuts } = result;

    // Convert repaired points back to normalized ratios for DB storage
    const refImageSize = baseMap?.getImageSize?.();
    if (!refImageSize) return;
    const { width: refW, height: refH } = refImageSize;

    const normalizedPoints = repairedPoints.map((p) => ({
      ...p,
      x: p.x / refW,
      y: p.y / refH,
    }));

    const updates = { points: normalizedPoints };

    if (repairedCuts) {
      updates.cuts = repairedCuts.map((cut) => ({
        ...cut,
        points: cut.points.map((p) => ({
          ...p,
          x: p.x / refW,
          y: p.y / refH,
        })),
      }));
    }

    await db.annotations.update(annotation.id, updates);

    // Also update db.points entries (resolvePoints prioritizes db.points)
    const allPoints = [
      ...normalizedPoints,
      ...(updates.cuts?.flatMap((c) => c.points) ?? []),
    ];
    const pointIds = allPoints.map((p) => p.id).filter(Boolean);
    if (pointIds.length > 0) {
      const existingDbPoints = await db.points
        .where("id")
        .anyOf(pointIds)
        .toArray();
      if (existingDbPoints.length > 0) {
        const dbPointsById = Object.fromEntries(
          existingDbPoints.map((p) => [p.id, p])
        );
        const pointUpdates = allPoints
          .filter((p) => dbPointsById[p.id])
          .map((p) => ({ ...dbPointsById[p.id], x: p.x, y: p.y }));
        await db.points.bulkPut(pointUpdates);
      }
    }
  }

  // render

  return (
    <Tooltip title="Réparer la géométrie">
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          color: "text.disabled",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <HealingIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
