import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSimplifyPolynomial,
  setSimplifyOuterContour,
} from "Features/smartDetect/smartDetectSlice";

import { Box, IconButton, Popover, Tooltip } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import IconSimplify from "./IconSimplify";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import * as turf from "@turf/turf";
import db from "App/db/db";

export default function IconButtonSimplifyAnnotation({
  annotation,
  accentColor,
}) {
  // data

  const dispatch = useDispatch();
  const simplifyPolynomial = useSelector(
    (s) => s.smartDetect.simplifyPolynomial
  );
  const simplifyOuterContour = useSelector(
    (s) => s.smartDetect.simplifyOuterContour
  );
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

  async function handleApply() {
    if (!annotation?.points?.length) return;

    const refImageSize = baseMap?.getImageSize?.();
    if (!refImageSize) return;
    const { width: refW, height: refH } = refImageSize;

    // Build GeoJSON coords from annotation points (already in ref pixel space)
    const coords = annotation.points.map((p) => [p.x, p.y]);

    // Build turf geometry
    const isPolygon = annotation.type === "POLYGON";
    let geometry;
    if (isPolygon) {
      // Close the ring for polygon
      const ring = [...coords, coords[0]];
      geometry = turf.polygon([ring]);
    } else {
      geometry = turf.lineString(coords);
    }

    // Truncate to remove decimal noise (we work in pixels)
    geometry = turf.truncate(geometry, { precision: 2 });

    // Apply polynomial simplification
    if (simplifyPolynomial) {
      geometry = turf.simplify(geometry, {
        tolerance: 1,
        highQuality: true,
      });
    }

    // Apply outer contour extraction (buffer in then out to remove interior walls)
    if (simplifyOuterContour && isPolygon) {
      const buffered = turf.buffer(geometry, -2, { units: "degrees" });
      if (buffered) {
        const expanded = turf.buffer(buffered, 2, { units: "degrees" });
        if (expanded) {
          // Handle MultiPolygon: take the largest polygon
          if (expanded.geometry.type === "MultiPolygon") {
            let maxArea = -1;
            let largest = null;
            for (const polyCoords of expanded.geometry.coordinates) {
              const poly = turf.polygon(polyCoords);
              const area = turf.area(poly);
              if (area > maxArea) {
                maxArea = area;
                largest = polyCoords;
              }
            }
            if (largest) {
              geometry = turf.polygon(largest);
            }
          } else {
            geometry = expanded;
          }
        }
      }
    }

    // Extract result coordinates
    let newCoords;
    if (isPolygon) {
      // Remove closing duplicate point from ring
      const ring = geometry.geometry.coordinates[0];
      newCoords = ring.slice(0, -1);
    } else {
      newCoords = geometry.geometry.coordinates;
    }

    // Guard against degenerate results
    const minPoints = isPolygon ? 3 : 2;
    if (newCoords.length < minPoints) return;

    // Build new points array with normalized ratios
    const newPoints = newCoords.map((coord, i) => {
      const original = annotation.points[i] || {};
      return {
        ...(i < annotation.points.length ? original : {}),
        x: coord[0] / refW,
        y: coord[1] / refH,
      };
    });

    // Build updates
    const updates = { points: newPoints };

    // If outer contour was applied, clear cuts (interior walls removed)
    if (simplifyOuterContour) {
      updates.cuts = [];
    }

    // Persist to Dexie
    await db.annotations.update(annotation.id, updates);

    // Sync db.points entries (resolvePoints prioritizes db.points)
    const allPoints = [
      ...newPoints,
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

    handleClose();
  }

  // render

  return (
    <>
      <Tooltip title="Simplifier la géométrie">
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
          <IconSimplify fontSize="small" />
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
          <FieldCheck
            value={simplifyPolynomial}
            onChange={(v) => dispatch(setSimplifyPolynomial(v))}
            label="Réduction polynomiale"
            options={{ type: "check", showAsInline: true }}
          />
          <FieldCheck
            value={simplifyOuterContour}
            onChange={(v) => dispatch(setSimplifyOuterContour(v))}
            label="Contour périphérique"
            options={{ type: "check", showAsInline: true }}
          />
          <ButtonInPanelV2 label="Appliquer" onClick={handleApply} />
        </Box>
      </Popover>
    </>
  );
}
