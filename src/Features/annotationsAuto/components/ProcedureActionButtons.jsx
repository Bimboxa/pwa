import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { setToaster } from "Features/layout/layoutSlice";

import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import fireFlash from "../utils/fireFlash";

import {
  Box,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { PlayArrow, Refresh, DeleteSweep } from "@mui/icons-material";

/**
 * play / reset / refresh buttons for an ANNOTATIONS_CREATOR procedure run over
 * a set of source annotations.
 *
 * `autoCreatedFrom` is ALWAYS a source annotation id: play tags every created
 * annotation with a source id (the first of the set), and reset/refresh act on
 * every annotation whose `autoCreatedFrom` belongs to `sourceAnnotationIds`.
 *
 * - Toolbar: a single source annotation → set = [annotation.id].
 * - Listing popper: all annotations of the source template → set = their ids,
 *   so deleting from the template removes everything the procedure created from
 *   any of its annotations.
 */
export default function ProcedureActionButtons({
  procedureKey,
  baseMapId,
  sourceAnnotationIds,
}) {
  const dispatch = useDispatch();

  // data

  const run = useAnnotationsAutoRun();
  const deleteAnnotations = useDeleteAnnotations();

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // helpers

  const sourceIds = sourceAnnotationIds ?? [];
  const sourceKey = sourceIds.join(",");

  // annotations created from any of the source annotations (for reset/refresh)
  const createdAnnotations = useLiveQuery(async () => {
    if (sourceIds.length === 0 || !baseMapId) return [];
    const sourceIdSet = new Set(sourceIds);
    const all = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return all.filter(
      (a) => !a.deletedAt && sourceIdSet.has(a.autoCreatedFrom)
    );
  }, [sourceKey, baseMapId, annotationsUpdatedAt]);

  // state

  const [running, setRunning] = useState(false);

  // helpers

  const createdCount = createdAnnotations?.length ?? 0;

  // handlers

  async function applyProcedure() {
    const result = await run({
      procedureKey,
      sourceAnnotationIds: sourceIds,
      // tag created annotations with a source annotation id (always an
      // annotationId); reset matches by source-id set membership.
      autoCreatedFrom: sourceIds[0],
    });
    const created = result?.annotations?.length ?? 0;
    if (created > 0) {
      fireFlash();
      dispatch(setToaster({ message: `${created} annotation(s) créée(s)` }));
    } else if (result?.error) {
      // procedure-specific failure message (e.g. open frontier loop)
      dispatch(setToaster({ message: result.error, severity: "warning" }));
    } else {
      dispatch(
        setToaster({
          message:
            "Aucune annotation créée. Vérifiez les catégories des modèles.",
          severity: "warning",
        })
      );
    }
  }

  async function resetProcedure() {
    const ids = (createdAnnotations ?? []).map((a) => a.id);
    if (ids.length === 0) return;
    await deleteAnnotations(ids);
    dispatch(
      setToaster({ message: `${ids.length} annotation(s) supprimée(s)` })
    );
  }

  async function handlePlay() {
    if (running) return;
    setRunning(true);
    try {
      await applyProcedure();
    } finally {
      setRunning(false);
    }
  }

  async function handleReset() {
    if (running) return;
    setRunning(true);
    try {
      await resetProcedure();
    } finally {
      setRunning(false);
    }
  }

  async function handleRefresh() {
    if (running) return;
    setRunning(true);
    try {
      await resetProcedure();
      await applyProcedure();
    } finally {
      setRunning(false);
    }
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      {running && <CircularProgress size={14} sx={{ mr: 0.5 }} />}
      <Tooltip title="Appliquer la procédure">
        <span>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={handlePlay}
            disabled={running}
            sx={{ minWidth: 0, px: 0.75, py: 0.25, borderRadius: 5 }}
          >
            <PlayArrow sx={{ fontSize: 18 }} />
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        title={
          createdCount > 0
            ? `Supprimer les ${createdCount} annotation(s) créée(s)`
            : "Aucune annotation à supprimer"
        }
      >
        <span>
          <IconButton
            size="small"
            onClick={handleReset}
            disabled={running || createdCount === 0}
          >
            <DeleteSweep sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Relancer (supprimer puis appliquer)">
        <span>
          <IconButton size="small" onClick={handleRefresh} disabled={running}>
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
