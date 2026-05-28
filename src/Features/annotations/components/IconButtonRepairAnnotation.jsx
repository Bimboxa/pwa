import { useSelector } from "react-redux";

import { IconButton, Tooltip } from "@mui/material";
import { Healing as HealingIcon } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import repairAnnotationGeometry from "../utils/repairAnnotationGeometry";
import {
  getStripWidthPx,
  stripEdgeToCenterline,
  centerlineToStripEdge,
} from "../utils/convertStripPolyline";

import db from "App/db/db";

export default function IconButtonRepairAnnotation({
  annotation,
  accentColor,
}) {
  // data

  const baseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // handlers

  async function handleClick() {
    if (!annotation?.points?.length) return;

    // STRIP: repair the band centerline, then re-derive the edge it stores.
    if (annotation.type === "STRIP") {
      await repairStrip();
      return;
    }

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

  async function repairStrip() {
    const refImageSize = baseMap?.getImageSize?.();
    if (!refImageSize) return;
    const { width: refW, height: refH } = refImageSize;
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    const Wpx = getStripWidthPx(annotation, meterByPx);
    const orientation = annotation.stripOrientation ?? 1;

    const centerline = stripEdgeToCenterline(
      annotation.points.map((p) => ({ x: p.x, y: p.y })),
      Wpx,
      orientation
    );

    const result = repairAnnotationGeometry({
      ...annotation,
      type: "POLYLINE",
      points: centerline,
      cuts: undefined,
    });
    if (!result) return;

    const edge = centerlineToStripEdge(
      result.repairedPoints.map((p) => ({ x: p.x, y: p.y })),
      Wpx,
      orientation
    );

    const records = edge.map((p) => ({
      id: p.id,
      x: p.x / refW,
      y: p.y / refH,
      projectId,
      baseMapId: annotation.baseMapId,
      listingId: annotation.listingId,
    }));
    const refs = records.map((r) => ({ id: r.id }));

    await db.transaction("rw", db.annotations, db.points, async () => {
      await db.points.bulkAdd(records);
      await db.annotations.update(annotation.id, { points: refs });
    });
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
