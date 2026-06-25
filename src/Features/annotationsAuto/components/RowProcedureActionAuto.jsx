import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { setToaster } from "Features/layout/layoutSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import fireFlash from "../utils/fireFlash";

import {
  Box,
  Typography,
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import {
  PlayArrow,
  Refresh,
  DeleteSweep,
  AutoFixHigh,
} from "@mui/icons-material";

/**
 * Toolbar row (between quantities and actions) for an annotation whose template
 * is linked to an ANNOTATIONS_CREATOR procedure. Left: procedure name. Right:
 * play (apply), reset (delete annotations created from this one), refresh
 * (reset + re-apply).
 */
export default function RowProcedureActionAuto({ annotation }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const run = useAnnotationsAutoRun();
  const deleteAnnotations = useDeleteAnnotations();

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const annotationId = annotation?.id;
  const baseMapId = annotation?.baseMapId;
  const procedureKey = annotation?.annotationTemplate?.procedureKey;
  const procedure = procedureKey
    ? procedures.find((p) => p.key === procedureKey)
    : null;

  // annotations created from this source annotation (for reset/refresh)
  const createdAnnotations = useLiveQuery(async () => {
    if (!annotationId || !baseMapId) return [];
    const all = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return all.filter(
      (a) => !a.deletedAt && a.autoCreatedFrom === annotationId
    );
  }, [annotationId, baseMapId, annotationsUpdatedAt]);

  // state

  const [running, setRunning] = useState(false);

  // helpers

  const createdCount = createdAnnotations?.length ?? 0;

  // handlers

  async function applyProcedure() {
    const result = await run({
      procedureKey,
      sourceAnnotationIds: [annotationId],
      autoCreatedFrom: annotationId,
    });
    const created = result?.annotations?.length ?? 0;
    if (created > 0) {
      fireFlash();
      dispatch(setToaster({ message: `${created} annotation(s) créée(s)` }));
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

  if (!procedure || procedure.type !== "ANNOTATIONS_CREATOR") return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.25,
        py: 0.5,
        gap: 0.5,
        bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.85),
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}
      >
        <AutoFixHigh sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
          {procedure.label}
        </Typography>
      </Box>

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
    </Box>
  );
}
