import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useRunProcedureReplacing from "Features/annotationsAuto/hooks/useRunProcedureReplacing";
import useProcedureOutputs from "Features/annotationsAuto/hooks/useProcedureOutputs";
import getProcedureOutputs from "Features/annotationsAuto/services/getProcedureOutputs";
import useRevolutionAxesOfBaseMap from "../hooks/useRevolutionAxesOfBaseMap";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

import ChipsRevolutionAxes from "./ChipsRevolutionAxes";

// strings

const STEP_TITLE = "Axe et fond de plan";
const AXIS_LABEL = "Axe";
const BASE_MAP_LABEL = "Fond de plan vertical";
const BASE_MAP_NAME_LABEL = "Nom du fond de plan à créer";
const NO_NAME = "Sans nom";
const CANCEL = "Annuler";
const NEXT = "Définir la géométrie";
const CREATE = "Créer";
const UPDATE = "Mettre à jour";
const DELETE = "Supprimer";
const deletedS = (n) => `${n} annotation(s) supprimée(s)`;

const EMPTY = [];

const getDefaultBaseMapName = (axis) => `Coupe ${axis?.label ?? "Axe"}`;

const sectionLabelSx = {
  display: "block",
  mb: 0.75,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  lineHeight: 1.4,
};

/**
 * Launch dialog of a revolution-axis system (château d'eau GO, réservoir)
 * from the « Dessin auto » band of the listing holding its templates — two
 * steps:
 *
 * 1. « Axe et fond de plan »: the axis of the scope to generate around
 *    (ChipsRevolutionAxes, first axis preselected) and the vertical page the
 *    drawing lands on: chips of the pages the axis is already posed on (its
 *    placements), else the name of the page created at launch (blank, sized
 *    by the system — the cotes dialog's own section), « Coupe <axe> » by
 *    default;
 * 2. the registry `paramsDialog` of the system (DialogProcedureRevolutionSection
 *    through its thin wrapper), fed with `setup = { listingId,
 *    verticalBaseMapId, baseMapName }`, whose confirm persists the cotes + the listing on
 *    the axis (association mark) and runs the system in replace-on-rerun mode
 *    (useRunProcedureReplacing). « Créer » / « Mettre à jour » + « Supprimer »
 *    according to the axis's live outputs.
 *
 * `initialAxisId` (axis toolbar / row menu) preselects the axis and skips
 * step 1 when that axis is already posed on a vertical page.
 */
export default function DialogProcedureAxisLaunch({
  open,
  procedure,
  listingId,
  initialAxisId = null,
  onClose,
}) {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const runReplacing = useRunProcedureReplacing();
  const deleteAnnotations = useDeleteAnnotations();

  const { value: baseMaps } = useBaseMaps({
    includeDetails: true,
    includeDisabledListings: true,
  });

  const paramsDialogLoader = procedure?.paramsDialog;
  const ParamsDialog = useMemo(
    () => (paramsDialogLoader ? lazy(paramsDialogLoader) : null),
    [paramsDialogLoader]
  );

  // state

  const [step, setStep] = useState(1);
  const [axisId, setAxisId] = useState(initialAxisId ?? "");
  // "linked" (page the axis is posed on) | "create"
  const [mode, setMode] = useState("create");
  const [linkedBaseMapId, setLinkedBaseMapId] = useState("");
  const [baseMapName, setBaseMapName] = useState("");
  const [busy, setBusy] = useState(false);

  // data - selected axis (live row: the cotes dialog reads procedureParams)

  const axis = useLiveQuery(
    () => (axisId ? db.annotations.get(axisId) : null),
    [axisId, annotationsUpdatedAt]
  );

  // placements of the axis → vertical pages it is posed on
  const axisItems = useRevolutionAxesOfBaseMap(axis?.baseMapId);
  const linkedBaseMaps = useMemo(() => {
    const item = axisItems.find((it) => it.axis.id === axisId);
    if (!item) return EMPTY;
    const byId = new Map((baseMaps ?? []).map((bm) => [bm.id, bm]));
    return item.placements
      .map((p) => byId.get(p.baseMapId))
      .filter((bm) => bm && !bm.deletedAt && bm.orientation === "VERTICAL");
  }, [axisItems, baseMaps, axisId]);

  const outputs = useProcedureOutputs({
    procedureKey: procedure?.key,
    sourceAnnotationIds: axisId ? [axisId] : EMPTY,
  });
  const hasOutputs = outputs.length > 0;

  // helpers

  const hasLinked = linkedBaseMaps.length > 0;
  const storedBaseMapId =
    axis?.procedureParams?.[procedure?.key]?.verticalBaseMapId;

  // Default mode / page follow the axis: posed → its page (the stored one
  // when it is among them); not posed → create.
  useEffect(() => {
    if (hasLinked) {
      setMode("linked");
      setLinkedBaseMapId((prev) => {
        if (prev && linkedBaseMaps.some((bm) => bm.id === prev)) return prev;
        const stored = linkedBaseMaps.find((bm) => bm.id === storedBaseMapId);
        return (stored ?? linkedBaseMaps[0]).id;
      });
    } else {
      setMode("create");
    }
  }, [axisId, hasLinked, linkedBaseMaps, storedBaseMapId]);

  // Name of the page created at launch follows the axis
  useEffect(() => {
    if (axis?.id) setBaseMapName(getDefaultBaseMapName(axis));
  }, [axis?.id]);

  // Preselected axis already posed: straight to the cotes
  const [autoSkipped, setAutoSkipped] = useState(false);
  useEffect(() => {
    if (autoSkipped || !initialAxisId || !axis || !hasLinked) return;
    setAutoSkipped(true);
    setStep(2);
  }, [autoSkipped, initialAxisId, axis, hasLinked]);

  const verticalBaseMapId = mode === "linked" ? linkedBaseMapId || null : null;
  const createdBaseMapName = mode === "create" ? baseMapName.trim() : null;

  const canGoNext =
    Boolean(axis) &&
    !axis?.deletedAt &&
    (mode === "create"
      ? Boolean(createdBaseMapName)
      : Boolean(verticalBaseMapId));

  const setup = useMemo(
    () => ({ listingId, verticalBaseMapId, baseMapName: createdBaseMapName }),
    [listingId, verticalBaseMapId, createdBaseMapName]
  );

  // handlers

  async function handleConfirm(params) {
    if (busy) return;
    setBusy(true);
    try {
      await runReplacing({
        procedureKey: procedure.key,
        sourceAnnotationIds: [axis.id],
        procedureParams: { ...(params ?? {}), listingId },
      });
    } finally {
      setBusy(false);
      onClose?.();
    }
  }

  async function handleDelete() {
    if (busy || !axis) return;
    setBusy(true);
    try {
      const rows = await getProcedureOutputs({
        projectId,
        procedureKey: procedure.key,
        sourceAnnotationIds: [axis.id],
        chainedProcedureKeys: procedure.chainedProcedureKeys,
        procedures,
      });
      const ids = rows.map((a) => a.id);
      if (ids.length > 0) {
        await deleteAnnotations(ids);
        dispatch(setToaster({ message: deletedS(ids.length) }));
      }
    } finally {
      setBusy(false);
      onClose?.();
    }
  }

  // render

  if (!open || !procedure) return null;

  if (step === 2 && ParamsDialog && axis && !axis.deletedAt) {
    return (
      <Suspense fallback={null}>
        <ParamsDialog
          open
          annotation={axis}
          setup={setup}
          hasOutputs={hasOutputs}
          confirmLabel={hasOutputs ? UPDATE : CREATE}
          deleteLabel={DELETE}
          onBack={() => setStep(1)}
          onDelete={hasOutputs ? handleDelete : null}
          onClose={onClose}
          onConfirm={handleConfirm}
        />
      </Suspense>
    );
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            lineHeight: 1.4,
          }}
        >
          {procedure.label}
        </Typography>
        {STEP_TITLE}
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        <Box sx={{ pt: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={sectionLabelSx}
          >
            {AXIS_LABEL}
          </Typography>
          <ChipsRevolutionAxes
            value={axisId}
            onChange={setAxisId}
            autoSelectFirst
          />
        </Box>

        {axis && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={sectionLabelSx}
            >
              {BASE_MAP_LABEL}
            </Typography>
            {hasLinked ? (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "nowrap",
                  overflowX: "auto",
                }}
              >
                {linkedBaseMaps.map((bm) => {
                  const selected = bm.id === linkedBaseMapId;
                  return (
                    <Chip
                      key={bm.id}
                      size="small"
                      label={bm.name ?? NO_NAME}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() => setLinkedBaseMapId(bm.id)}
                      sx={{ flexShrink: 0 }}
                    />
                  );
                })}
              </Box>
            ) : (
              <TextField
                size="small"
                fullWidth
                label={BASE_MAP_NAME_LABEL}
                value={baseMapName}
                onChange={(e) => setBaseMapName(e.target.value)}
                error={baseMapName.trim().length === 0}
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{CANCEL}</Button>
        <Button
          variant="contained"
          disabled={!canGoNext}
          onClick={() => setStep(2)}
        >
          {NEXT}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
