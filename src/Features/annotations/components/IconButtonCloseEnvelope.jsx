import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useCloseEnvelope from "../hooks/useCloseEnvelope";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";
import { triggerAnnotationsUpdate } from "../annotationsSlice";
import {
  getStripWidthPx,
  stripEdgeToCenterline,
  centerlineToStripEdge,
  getStripProps,
} from "../utils/convertStripPolyline";

import { CircularProgress, IconButton, Menu, Tooltip } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconCloseEnvelope from "Features/icons/IconCloseEnvelope";

import db from "App/db/db";

export default function IconButtonCloseEnvelope({ annotations, accentColor }) {
  // data

  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const closeEnvelope = useCloseEnvelope();
  const baseMap = useMainBaseMap();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  // helpers

  const polylineTemplates = allTemplates?.filter(
    (t) => resolveDrawingShape(t) === "POLYLINE"
  );

  const wallCandidates = annotations?.filter((a) =>
    ["POLYLINE", "STRIP"].includes(a.type)
  );
  const hasStrip = wallCandidates?.some((a) => a.type === "STRIP");

  // handlers

  function handleOpen(event) { setAnchorEl(event.currentTarget); }
  function handleClose() { setAnchorEl(null); }

  async function handleTemplateChange(annotationTemplateId) {
    if (!wallCandidates?.length) return;
    setLoading(true);
    handleClose();
    try {
      const created = hasStrip
        ? await closeEnvelopeForStrips(annotationTemplateId)
        : await closeEnvelope({
            annotations: wallCandidates,
            annotationTemplateId,
          });
      console.log(`[CloseEnvelope] ${created.length} closing segments created`);
    } catch (e) {
      console.error("[CloseEnvelope]", e);
    } finally {
      setLoading(false);
    }
  }

  // STRIP: close the envelope on the band centerlines (reusing the polyline
  // algorithm), then turn each closing segment back into a STRIP band.
  async function closeEnvelopeForStrips(annotationTemplateId) {
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    if (!imageSize?.width || !imageSize?.height) return [];
    const { width, height } = imageSize;
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;

    const strip = wallCandidates.find((a) => a.type === "STRIP");
    const Wpx = getStripWidthPx(strip, meterByPx);
    const orientation = strip.stripOrientation ?? 1;
    const stripProps = getStripProps(strip);

    // Build centerline polylines, persist their points, keep a coord lookup.
    const centerlinePolylines = [];
    const centerlinePoints = [];
    const coordById = new Map();
    for (const a of wallCandidates) {
      if (a.type === "STRIP") {
        const centerline = stripEdgeToCenterline(
          (a.points ?? []).map((p) => ({ x: p.x, y: p.y })),
          getStripWidthPx(a, meterByPx),
          a.stripOrientation ?? 1
        );
        for (const p of centerline) {
          coordById.set(p.id, { x: p.x, y: p.y });
          centerlinePoints.push({
            id: p.id,
            x: p.x / width,
            y: p.y / height,
            projectId,
            baseMapId: a.baseMapId,
            listingId: a.listingId,
          });
        }
        centerlinePolylines.push({ ...a, type: "POLYLINE", points: centerline });
      } else {
        centerlinePolylines.push(a);
        for (const p of a.points ?? []) {
          if (p.id && p.x != null) coordById.set(p.id, { x: p.x, y: p.y });
        }
      }
    }

    if (centerlinePoints.length > 0) await db.points.bulkAdd(centerlinePoints);

    const created = await closeEnvelope({
      annotations: centerlinePolylines,
      annotationTemplateId,
    });
    if (!created?.length) return [];

    // Reconvert each closing polyline segment into a STRIP edge.
    const edgeRecords = [];
    const updates = [];
    for (const seg of created) {
      const [r1, r2] = seg.points ?? [];
      const c1 = coordById.get(r1?.id);
      const c2 = coordById.get(r2?.id);
      if (!c1 || !c2) continue;
      const edge = centerlineToStripEdge([c1, c2], Wpx, orientation);
      if (edge.length < 2) continue;
      for (const p of edge) {
        edgeRecords.push({
          id: p.id,
          x: p.x / width,
          y: p.y / height,
          projectId,
          baseMapId: seg.baseMapId,
          listingId: seg.listingId,
        });
      }
      updates.push({
        id: seg.id,
        type: "STRIP",
        points: edge.map((p) => ({ id: p.id })),
        ...stripProps,
      });
    }

    await db.transaction("rw", db.annotations, db.points, async () => {
      if (edgeRecords.length > 0) await db.points.bulkAdd(edgeRecords);
      for (const u of updates) {
        const { id, ...rest } = u;
        await db.annotations.update(id, rest);
      }
    });
    dispatch(triggerAnnotationsUpdate());

    return created;
  }

  // render

  return (
    <>
      <Tooltip title="Fermer l'enveloppe">
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={loading || !wallCandidates?.length}
            sx={{
              color: "text.disabled",
              "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
            }}
          >
            {loading ? <CircularProgress size={18} /> : <IconCloseEnvelope fontSize="small" />}
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
