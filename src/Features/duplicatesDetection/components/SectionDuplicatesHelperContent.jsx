import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { clearDetection, setToleranceCm } from "../duplicatesDetectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  InputAdornment,
  LinearProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import Refresh from "@mui/icons-material/Refresh";
import DeleteSweep from "@mui/icons-material/DeleteSweep";

import RowDuplicateAnnotation from "./RowDuplicateAnnotation";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useLayers from "Features/layers/hooks/useLayers";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";
import useRunDuplicatesDetection from "../hooks/useRunDuplicatesDetection";
import useDuplicatesHelperRows from "../hooks/useDuplicatesHelperRows";
import useCutOverlapsHelperRows from "../hooks/useCutOverlapsHelperRows";
import mergeOverlappingCutsService from "../services/mergeOverlappingCutsService";
import findDuplicateAnnotations from "Features/annotations/utils/findDuplicateAnnotations";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import isEditableTarget from "Features/commandsToolbar/utils/isEditableTarget";

// ---------------------------------------------------------------------------
// SectionDuplicatesHelperContent — body of the duplicates helper, shared by
// the docked Dessin panel (SectionPanelDuplicatesHelper) and the floating
// popper (PopperDuplicatesHelper): tolerance field + « Relancer », progress
// while running, then the summary and one row per duplicate (click = select
// on the map). « Supprimer les doublons exacts » deletes, in one batch, the
// copies with the very same geometry on the same layer (the oldest of each
// group is kept), then relaunches the run. A second list, « Ouvertures
// superposées », shows the polygons whose own openings (cuts) overlap each
// other — their area comes off the surface more than once — each row with a
// « Réparer » button replacing its overlapping groups by their union.
// Only mounted while a run exists (status !== "idle"), so its
// own annotations query (same scope as the « Doublons » card) runs only then.
// Escape closes the helper (clearDetection).
// ---------------------------------------------------------------------------

export default function SectionDuplicatesHelperContent() {
  const dispatch = useDispatch();

  // strings

  const toleranceS = "Tolérance";
  const relaunchS = "Relancer";
  const runningS = "Analyse en cours…";
  const noneS = "Aucun doublon détecté";
  const errorS = "Échec de la détection";
  const hintS = "Cliquez une ligne pour la sélectionner sur le plan";
  const deleteExactS = "Supprimer les doublons exacts";
  const cutOverlapsS = "Ouvertures superposées";
  const repairS = "Réparer";

  // data

  const status = useSelector((s) => s.duplicatesDetection.status);
  const result = useSelector((s) => s.duplicatesDetection.result);
  const error = useSelector((s) => s.duplicatesDetection.error);
  const toleranceCm = useSelector((s) => s.duplicatesDetection.toleranceCm);
  const runMeterByPx = useSelector((s) => s.duplicatesDetection.meterByPx);
  const runHasScale = useSelector((s) => s.duplicatesDetection.hasScale);
  const selectedItem = useSelector(selectSelectedItem);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const baseMap = useMainBaseMap();
  const annotations = useAnnotationsV2({
    caller: "DuplicatesHelper",
    filterByMainBaseMap: true,
    hideBaseMapAnnotations: true,
    ignoreSolo: true,
  });
  const templates = useAnnotationTemplates();
  const templateById = useMemo(
    () => getItemsByKey(templates ?? [], "id"),
    [templates]
  );

  const layers = useLayers({
    filterByBaseMapId: baseMap?.id,
    filterByScopeId: selectedScopeId,
  });
  const layerById = useMemo(() => getItemsByKey(layers ?? [], "id"), [layers]);

  const run = useRunDuplicatesDetection();
  const deleteAnnotations = useDeleteAnnotations();
  const selectAnnotation = useSelectAnnotationFromPanel();

  const { rows, missingCount } = useDuplicatesHelperRows({
    result,
    annotations,
    templateById,
    layerById,
    meterByPx: runMeterByPx,
    hasScale: runHasScale,
  });

  // polygons whose own openings overlap each other
  const { rows: cutRows } = useCutOverlapsHelperRows({
    result,
    annotations,
    templateById,
    meterByPx: runMeterByPx,
    hasScale: runHasScale,
  });

  // exact duplicates among the listed ones: same template, type, layer and
  // geometry — the oldest annotation of each group is kept
  const exactDuplicateIds = useMemo(
    () =>
      findDuplicateAnnotations(
        rows.map((row) => row.annotation),
        { crossLayers: false }
      ).duplicateIds,
    [rows]
  );

  // state

  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergingCuts, setMergingCuts] = useState(false);

  // helpers

  const running = status === "running";
  const duplicatesCount = result?.duplicates?.length ?? 0;
  const pairsCount = result?.pairs?.length ?? 0;
  const cutOverlapsCount = cutRows.length;
  const summaryS =
    duplicatesCount === 0
      ? cutOverlapsCount === 0
        ? noneS
        : null
      : `${duplicatesCount} doublon${duplicatesCount > 1 ? "s" : ""} · ${pairsCount} paire${pairsCount > 1 ? "s" : ""}`;
  const missingS =
    missingCount > 0
      ? `${missingCount} annotation${missingCount > 1 ? "s" : ""} supprimée${missingCount > 1 ? "s" : ""} depuis l'analyse`
      : null;
  const selectedAnnotationId = selectedItem?.nodeId ?? selectedItem?.id ?? null;
  const exactCount = exactDuplicateIds.length;
  const deleteMessageS = `Supprimer ${exactCount} doublon${exactCount > 1 ? "s" : ""} exact${exactCount > 1 ? "s" : ""} (même calque, géométrie identique) ? L'annotation la plus ancienne de chaque groupe est conservée.`;

  // effect - Escape closes the helper (not while typing in the field)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || isEditableTarget(e.target)) return;
      if (openDelete) return; // Escape only closes the confirmation dialog
      dispatch(clearDetection());
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dispatch, openDelete]);

  // handlers

  function relaunch(annotationsToCheck) {
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    run(annotationsToCheck ?? [], { meterByPx, baseMapId: baseMap?.id });
  }

  function handleRelaunch() {
    if (running) return;
    relaunch(annotations);
  }

  async function handleDeleteExactDuplicates() {
    if (deleting || exactCount === 0) return;
    const deletedIds = new Set(exactDuplicateIds);
    setDeleting(true);
    try {
      // one batch: single transaction, single undo step
      await deleteAnnotations(exactDuplicateIds);
      if (deletedIds.has(selectedAnnotationId)) dispatch(clearSelection());
      // the live query has not caught up yet: filter the deleted ones out
      relaunch((annotations ?? []).filter((a) => !deletedIds.has(a.id)));
    } finally {
      setDeleting(false);
      setOpenDelete(false);
    }
  }

  // repairs one row: each group of overlapping openings of the annotation
  // becomes one opening (their union) — one transaction, one undo step
  async function handleRepairCuts(row) {
    if (mergingCuts || running) return;
    setMergingCuts(true);
    try {
      const { mergedAnnotationIds, skippedClusters } =
        await mergeOverlappingCutsService({
          annotations,
          cutOverlaps: [row],
          baseMap,
        });
      if (skippedClusters > 0) {
        dispatch(
          setToaster({
            message: `${skippedClusters} groupe${skippedClusters > 1 ? "s" : ""} d'ouvertures non fusionné${skippedClusters > 1 ? "s" : ""} (ouvertures liées ou union impossible) — relancez l'analyse`,
            isError: true,
          })
        );
      }
      // the live query has not caught up yet: the next run would still see
      // the old cuts of the merged annotations, so they are left out of it —
      // « Relancer » checks them again.
      if (mergedAnnotationIds.length > 0) {
        const mergedIds = new Set(mergedAnnotationIds);
        relaunch(
          (annotations ?? []).map((a) =>
            mergedIds.has(a.id) ? { ...a, cuts: [] } : a
          )
        );
      }
    } catch (e) {
      console.error("[duplicatesDetection] merge of the cuts failed:", e);
      dispatch(
        setToaster({
          message: "Échec de la fusion des ouvertures",
          isError: true,
        })
      );
    } finally {
      setMergingCuts(false);
    }
  }

  function handleToleranceChange(e) {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || value <= 0) return;
    dispatch(setToleranceCm(value));
  }

  function handleRowClick(row) {
    selectAnnotation(row.annotation);
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
      <Paper
        elevation={0}
        sx={{
          px: 1,
          py: 0.5,
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {toleranceS}
        </Typography>
        <TextField
          size="small"
          type="number"
          value={toleranceCm}
          onChange={handleToleranceChange}
          disabled={running}
          sx={{ width: 96 }}
          slotProps={{
            htmlInput: { min: 0.1, step: 0.5, style: { textAlign: "right" } },
            input: {
              endAdornment: <InputAdornment position="end">cm</InputAdornment>,
              sx: { fontSize: "0.8125rem" },
            },
          }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<Refresh fontSize="small" />}
          onClick={handleRelaunch}
          disabled={running}
          sx={{ textTransform: "none", whiteSpace: "nowrap" }}
        >
          {relaunchS}
        </Button>
      </Paper>

      {running && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            {runningS}
          </Typography>
        </Box>
      )}

      {status === "error" && (
        <Typography variant="body2" color="error.main">
          {errorS}
          {error ? ` — ${error}` : ""}
        </Typography>
      )}

      {result && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            opacity: running ? 0.5 : 1,
            pointerEvents: running ? "none" : "auto",
          }}
        >
          {summaryS && (
            <Typography variant="body2" sx={{ fontWeight: 600, px: 0.5 }}>
              {summaryS}
            </Typography>
          )}
          {missingS && (
            <Typography variant="caption" color="warning.main" sx={{ px: 0.5 }}>
              {missingS}
            </Typography>
          )}
          {exactCount > 0 && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteSweep fontSize="small" />}
              onClick={() => setOpenDelete(true)}
              disabled={running || deleting}
              sx={{ textTransform: "none", alignSelf: "flex-start" }}
            >
              {`${deleteExactS} (${exactCount})`}
            </Button>
          )}
          {rows.length > 0 && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ px: 0.5 }}
              >
                {hintS}
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                {rows.map((row) => (
                  <RowDuplicateAnnotation
                    key={row.annotationId}
                    row={row}
                    selected={row.annotationId === selectedAnnotationId}
                    onClick={handleRowClick}
                  />
                ))}
              </Paper>
            </>
          )}
          {cutOverlapsCount > 0 && (
            <>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, px: 0.5, mt: 1 }}
              >
                {cutOverlapsS}
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                {cutRows.map((row) => (
                  <RowDuplicateAnnotation
                    key={row.annotationId}
                    row={row}
                    selected={row.annotationId === selectedAnnotationId}
                    onClick={handleRowClick}
                    action={{
                      label: repairS,
                      onClick: handleRepairCuts,
                      disabled: running || mergingCuts,
                    }}
                  />
                ))}
              </Paper>
            </>
          )}
        </Box>
      )}

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleDeleteExactDuplicates}
        message={deleteMessageS}
      />
    </Box>
  );
}
