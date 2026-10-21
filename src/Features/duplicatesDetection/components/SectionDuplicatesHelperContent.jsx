import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { clearDetection, setToleranceCm } from "../duplicatesDetectionSlice";

import { selectSelectedItem } from "Features/selection/selectionSlice";

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

import RowDuplicateAnnotation from "./RowDuplicateAnnotation";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectAnnotationFromPanel from "Features/panelDrawing/hooks/useSelectAnnotationFromPanel";
import useRunDuplicatesDetection from "../hooks/useRunDuplicatesDetection";
import useDuplicatesHelperRows from "../hooks/useDuplicatesHelperRows";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import isEditableTarget from "Features/commandsToolbar/utils/isEditableTarget";

// ---------------------------------------------------------------------------
// SectionDuplicatesHelperContent — body of the duplicates helper, shared by
// the docked Dessin panel (SectionPanelDuplicatesHelper) and the floating
// popper (PopperDuplicatesHelper): tolerance field + « Relancer », progress
// while running, then the summary and one row per duplicate (click = select
// on the map). Only mounted while a run exists (status !== "idle"), so its
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

  // data

  const status = useSelector((s) => s.duplicatesDetection.status);
  const result = useSelector((s) => s.duplicatesDetection.result);
  const error = useSelector((s) => s.duplicatesDetection.error);
  const toleranceCm = useSelector((s) => s.duplicatesDetection.toleranceCm);
  const runMeterByPx = useSelector((s) => s.duplicatesDetection.meterByPx);
  const runHasScale = useSelector((s) => s.duplicatesDetection.hasScale);
  const selectedItem = useSelector(selectSelectedItem);

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

  const run = useRunDuplicatesDetection();
  const selectAnnotation = useSelectAnnotationFromPanel();

  const { rows, missingCount } = useDuplicatesHelperRows({
    result,
    annotations,
    templateById,
    meterByPx: runMeterByPx,
    hasScale: runHasScale,
  });

  // helpers

  const running = status === "running";
  const duplicatesCount = result?.duplicates?.length ?? 0;
  const pairsCount = result?.pairs?.length ?? 0;
  const summaryS =
    duplicatesCount === 0
      ? noneS
      : `${duplicatesCount} doublon${duplicatesCount > 1 ? "s" : ""} · ${pairsCount} paire${pairsCount > 1 ? "s" : ""}`;
  const missingS =
    missingCount > 0
      ? `${missingCount} annotation${missingCount > 1 ? "s" : ""} supprimée${missingCount > 1 ? "s" : ""} depuis l'analyse`
      : null;
  const selectedAnnotationId = selectedItem?.nodeId ?? selectedItem?.id ?? null;

  // effect - Escape closes the helper (not while typing in the field)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || isEditableTarget(e.target)) return;
      dispatch(clearDetection());
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dispatch]);

  // handlers

  function handleRelaunch() {
    if (running) return;
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    run(annotations ?? [], { meterByPx, baseMapId: baseMap?.id });
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
          <Typography variant="body2" sx={{ fontWeight: 600, px: 0.5 }}>
            {summaryS}
          </Typography>
          {missingS && (
            <Typography variant="caption" color="warning.main" sx={{ px: 0.5 }}>
              {missingS}
            </Typography>
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
        </Box>
      )}
    </Box>
  );
}
