import { useState } from "react";

import useWallBoundaries from "Features/smartDetect/hooks/useWallBoundaries";
import usePolygonContours from "Features/smartDetect/hooks/usePolygonContours";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { getStripWidthPx } from "Features/annotations/utils/convertStripPolyline";
import offsetControlPolyline from "Features/geometry/utils/offsetControlPolyline";

import { Box, CircularProgress, Typography } from "@mui/material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import CommandButton from "../../components/CommandButton";
import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";
import { CONTOURS_TYPES } from "./contoursCommand";

// Toolbar button of « Contours » (commandsToolbar): menu with the contour
// type and the polyline template picker.
export default function ButtonContours({ command, ctx, state, hotkeyLabel }) {
  // data

  const annotations = getTargets(ctx, CONTOURS_TYPES);
  const baseMap = ctx.baseMap;
  const computeBoundaries = useWallBoundaries();
  const computePolygonContours = usePolygonContours();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contourType, setContourType] = useState("POLYLINE");
  const open = Boolean(anchorEl);

  // helpers

  const filterPolylineTemplate = (t) => resolveDrawingShape(t) === "POLYLINE";

  const wallCandidates = annotations?.filter((a) =>
    ["POLYLINE", "STRIP"].includes(a.type)
  );

  const polygonCandidates = annotations?.filter((a) => a.type === "POLYGON");

  // A STRIP stores one edge of the band: feed the contours algorithm its
  // centerline + the band thickness so the produced boundaries hug both edges.
  function toWallPolyline(a) {
    if (a.type !== "STRIP") return a;
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    const Wpx = getStripWidthPx(a, meterByPx);
    const orientation = a.stripOrientation ?? 1;
    const closed = a.closeLine === true;
    // Arc-aware offset (NOT the flat stripEdgeToCenterline) so an S-C-S arc on
    // the strip edge survives as an S-C-S arc on the centerline — otherwise the
    // contour hook sees no source arc and produces a faceted boundary.
    const centerline = offsetControlPolyline(
      a.points ?? [],
      (orientation * Wpx) / 2,
      closed
    );
    return {
      ...a,
      type: "POLYLINE",
      points: centerline,
      // computeBoundaries reads strokeWidth as CM; encode Wpx back into CM so
      // halfWidth === Wpx/2 regardless of the strip's original unit.
      strokeWidth: meterByPx > 0 ? Wpx * meterByPx * 100 : Wpx,
      strokeWidthUnit: "CM",
      closeLine: closed,
    };
  }

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchor);
  }
  function handleClose() {
    setAnchorEl(null);
  }

  async function handleTemplateChange(annotationTemplateId, template) {
    if (!template || (!wallCandidates?.length && !polygonCandidates?.length))
      return;
    setLoading(true);
    handleClose();
    try {
      let count = 0;
      if (wallCandidates?.length) {
        const result = await computeBoundaries({
          wallAnnotations: wallCandidates.map(toWallPolyline),
          boundaryAnnotationTemplate: template,
          outputType: contourType,
        });
        count += result.count;
      }
      if (polygonCandidates?.length) {
        const result = await computePolygonContours({
          polygonAnnotations: polygonCandidates,
          boundaryAnnotationTemplate: template,
          outputType: contourType,
        });
        count += result.count;
      }
      console.log(`[Contours] ${count} contour annotations created`);
    } catch (e) {
      console.error("[Contours]", e);
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={loading ? undefined : command.Icon}
        icon={loading ? <CircularProgress size={18} /> : undefined}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, enabled: state.enabled && !loading, active: open }}
        onClick={handleOpen}
      />

      <MenuPickAnnotationTemplate
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        filterTemplate={filterPolylineTemplate}
        onChange={handleTemplateChange}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Type du contour
          </Typography>
          <ToggleSingleSelectorGeneric
            selectedKey={contourType}
            options={[
              { key: "STRIP", label: "Bande" },
              { key: "POLYLINE", label: "Polyline" },
            ]}
            onChange={(v) => setContourType(v ?? "POLYLINE")}
          />
        </Box>
      </MenuPickAnnotationTemplate>
    </>
  );
}
