import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import useCloseEnvelope from "Features/annotations/hooks/useCloseEnvelope";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import {
  getStripWidthPx,
  stripEdgeToCenterline,
  centerlineToStripEdge,
  getStripProps,
} from "Features/annotations/utils/convertStripPolyline";

import { CircularProgress } from "@mui/material";

import db from "App/db/db";

import CommandButton from "../../components/CommandButton";
import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";
import { CLOSE_ENVELOPE_TYPES } from "./closeEnvelopeCommand";

// Toolbar button of « Fermer l'enveloppe » (commandsToolbar): polyline
// template picker menu.
export default function ButtonCloseEnvelope({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  // data

  const dispatch = useDispatch();
  const annotations = getTargets(ctx, CLOSE_ENVELOPE_TYPES);
  const baseMap = ctx.baseMap;
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const closeEnvelope = useCloseEnvelope();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  // helpers

  const filterPolylineTemplate = (t) => resolveDrawingShape(t) === "POLYLINE";

  const wallCandidates = annotations?.filter((a) =>
    ["POLYLINE", "STRIP"].includes(a.type)
  );
  const hasStrip = wallCandidates?.some((a) => a.type === "STRIP");

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchor);
  }
  function handleClose() {
    setAnchorEl(null);
  }

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
        centerlinePolylines.push({
          ...a,
          type: "POLYLINE",
          points: centerline,
        });
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
      />
    </>
  );
}
