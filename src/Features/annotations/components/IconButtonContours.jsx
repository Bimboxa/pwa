import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useWallBoundaries from "Features/smartDetect/hooks/useWallBoundaries";
import usePolygonContours from "Features/smartDetect/hooks/usePolygonContours";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";
import { getStripWidthPx } from "../utils/convertStripPolyline";
import offsetControlPolyline from "Features/geometry/utils/offsetControlPolyline";

import {
  Box,
  CircularProgress,
  IconButton,
  Menu,
  Tooltip,
  Typography,
} from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import IconContours from "Features/icons/IconContours";

export default function IconButtonContours({ annotations, accentColor }) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const computeBoundaries = useWallBoundaries();
  const computePolygonContours = usePolygonContours();
  const baseMap = useMainBaseMap();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contourType, setContourType] = useState("POLYLINE");
  const open = Boolean(anchorEl);

  // helpers

  const polylineTemplates = allTemplates?.filter(
    (t) => resolveDrawingShape(t) === "POLYLINE"
  );

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

  function handleOpen(event) {
    setAnchorEl(event.currentTarget);
  }
  function handleClose() {
    setAnchorEl(null);
  }

  async function handleTemplateChange(annotationTemplateId) {
    const template = allTemplates?.find((t) => t.id === annotationTemplateId);
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
      <Tooltip title="Contours">
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={
              loading || (!wallCandidates?.length && !polygonCandidates?.length)
            }
            sx={{
              color: "text.disabled",
              "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
            }}
          >
            {loading ? (
              <CircularProgress size={18} />
            ) : (
              <IconContours fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
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
        <SelectorAnnotationTemplateVariantDense
          selectedAnnotationTemplateId={null}
          onChange={handleTemplateChange}
          annotationTemplates={polylineTemplates}
          listings={listings}
        />
      </Menu>
    </>
  );
}
