import { lazy, Suspense, useMemo, useState } from "react";
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
 * `autoCreatedFrom` is ALWAYS a source annotation id: procedures that track
 * sources per output (fromPolygonsToBim) tag each created annotation with its
 * own source polygon id; the run-level id passed to play (first of the set) is
 * only a fallback for untagged annotations. Reset/refresh act on every
 * annotation whose `autoCreatedFrom` belongs to `sourceAnnotationIds`.
 *
 * - Toolbar: a single source annotation → set = [annotation.id].
 * - Listing popper: all annotations of the source template → set = their ids,
 *   so deleting from the template removes everything the procedure created from
 *   any of its annotations.
 * - "Dessin auto" panel: standardRun = true → play runs the standard flow
 *   (sourceListingId / source-less) instead of the selection flow; set = all
 *   annotations linked to the procedure on the base map (reset scope).
 */
export default function ProcedureActionButtons({
  procedureKey,
  baseMapId,
  sourceAnnotationIds,
  sourceListingId = null,
  standardRun = false,
  disabled = false,
}) {
  const dispatch = useDispatch();

  // data

  const run = useAnnotationsAutoRun();
  const deleteAnnotations = useDeleteAnnotations();

  const appConfig = useAppConfig();
  const procedure = (appConfig?.automatedAnnotationsProcedures ?? []).find(
    (p) => p.key === procedureKey
  );

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
  const [paramsDialogOpen, setParamsDialogOpen] = useState(false);

  // helpers

  const createdCount = createdAnnotations?.length ?? 0;

  // helpers - procedure-specific params dialog (registry entry paramsDialog),
  // lazy-loaded like the procedure module itself. Only the single-source
  // selection flow opens it (the dialog reads/writes the source annotation).

  const paramsDialogLoader = procedure?.paramsDialog;
  const ParamsDialog = useMemo(
    () => (paramsDialogLoader ? lazy(paramsDialogLoader) : null),
    [paramsDialogLoader]
  );
  const usesParamsDialog =
    Boolean(ParamsDialog) && !standardRun && sourceIds.length === 1;

  const sourceAnnotation = useLiveQuery(async () => {
    if (!usesParamsDialog) return null;
    return db.annotations.get(sourceIds[0]);
  }, [usesParamsDialog, sourceKey, annotationsUpdatedAt]);

  const storedProcedureParams =
    sourceAnnotation?.procedureParams?.[procedureKey];

  // handlers

  async function applyProcedure(procedureParams) {
    const result = await run(
      standardRun
        ? {
            // standard flow (listing / source-less): the run recomputes its
            // sources; sourceIds only provides the untagged-output fallback.
            sourceListingId,
            procedureKey,
            autoCreatedFrom: sourceIds[0],
          }
        : {
            procedureKey,
            sourceAnnotationIds: sourceIds,
            // fallback source tag for annotations the procedure leaves
            // untagged; reset matches by source-id set membership.
            autoCreatedFrom: sourceIds[0],
            procedureParams,
          }
    );
    const created = result?.annotations?.length ?? 0;
    const updated = result?.updatedAnnotations?.length ?? 0;
    if (created > 0 || updated > 0) {
      fireFlash();
      const message =
        created > 0
          ? `${created} annotation(s) créée(s)`
          : `${updated} annotation(s) mise(s) à jour`;
      dispatch(setToaster({ message }));
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
    if (usesParamsDialog) {
      setParamsDialogOpen(true);
      return;
    }
    setRunning(true);
    try {
      await applyProcedure();
    } finally {
      setRunning(false);
    }
  }

  async function handleParamsDialogConfirm(procedureParams) {
    setParamsDialogOpen(false);
    if (running) return;
    setRunning(true);
    try {
      await applyProcedure(procedureParams);
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
    // Params-dialog procedures re-run from the values stored on the source
    // annotation; when none were stored yet, ask for them first.
    if (usesParamsDialog && !storedProcedureParams) {
      setParamsDialogOpen(true);
      return;
    }
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
            disabled={running || disabled}
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
          <IconButton
            size="small"
            onClick={handleRefresh}
            disabled={running || disabled}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      {ParamsDialog && paramsDialogOpen && (
        <Suspense fallback={null}>
          <ParamsDialog
            open
            annotation={sourceAnnotation}
            onClose={() => setParamsDialogOpen(false)}
            onConfirm={handleParamsDialogConfirm}
          />
        </Suspense>
      )}
    </Box>
  );
}
