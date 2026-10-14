import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useVerticalBaseMapsByListing from "Features/baseMapLinks/hooks/useVerticalBaseMapsByListing";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useRunProcedureReplacing from "Features/annotationsAuto/hooks/useRunProcedureReplacing";
import useProcedureOutputs from "Features/annotationsAuto/hooks/useProcedureOutputs";
import getProcedureOutputs from "Features/annotationsAuto/services/getProcedureOutputs";
import isRevolutionHelperInScope, {
  getScopeIdByListingId,
} from "Features/annotations/utils/isRevolutionHelperInScope";
import useRevolutionAxesOfBaseMap from "../hooks/useRevolutionAxesOfBaseMap";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  ListSubheader,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";

import FieldRevolutionAxisSelect from "./FieldRevolutionAxisSelect";

// strings

const STEP_TITLE = "Axe et fond de plan";
const AXIS_HELPER = "L'ouvrage est généré en révolution autour de cet axe.";
const LINKED_TITLE = "Fond de plan vertical";
const LINKED_ONE_PREFIX = "Fond de plan vertical : ";
const LINKED_DESCRIPTION =
  "Le dessin est généré sur le fond de plan vertical où l'axe est posé.";
const NO_LINKED_DESCRIPTION =
  "L'axe n'est posé sur aucun fond de plan vertical.";
const CREATE_LABEL =
  "Créer un fond de plan vertical (page blanche à l'échelle)";
const EXISTING_LABEL = "Utiliser un fond de plan vertical existant";
const EXISTING_SELECT_LABEL = "Fond de plan vertical";
const EXISTING_HELPER =
  "L'axe y sera posé automatiquement au lancement (base en bas au milieu).";
const NO_EXISTING = "Aucun fond de plan vertical disponible.";
const CANCEL = "Annuler";
const NEXT = "Définir la géométrie";
const CREATE = "Créer";
const UPDATE = "Mettre à jour";
const DELETE = "Supprimer";
const deletedS = (n) => `${n} annotation(s) supprimée(s)`;

const EMPTY = [];

/**
 * Launch dialog of a revolution-axis system (château d'eau GO, réservoir)
 * from the « Dessin auto » band of the listing holding its templates — two
 * steps:
 *
 * 1. « Axe et fond de plan »: the axis of the scope to generate around
 *    (FieldRevolutionAxisSelect) and the vertical page the drawing lands on:
 *    the page the axis is already posed on (one of its placements), else a
 *    page created at launch (blank, sized by the system — the cotes dialog's
 *    own section) or an existing vertical base map the run poses the axis on
 *    (createRevolutionRunOutputs creates the missing placement);
 * 2. the registry `paramsDialog` of the system (DialogProcedureRevolutionSection
 *    through its thin wrapper), fed with `setup = { listingId,
 *    verticalBaseMapId }`, whose confirm persists the cotes + the listing on
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

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
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
  const { groups: verticalGroups } = useVerticalBaseMapsByListing();

  const paramsDialogLoader = procedure?.paramsDialog;
  const ParamsDialog = useMemo(
    () => (paramsDialogLoader ? lazy(paramsDialogLoader) : null),
    [paramsDialogLoader]
  );

  // state

  const [step, setStep] = useState(1);
  const [axisId, setAxisId] = useState(initialAxisId ?? "");
  // "linked" (page the axis is posed on) | "create" | "existing"
  const [mode, setMode] = useState("create");
  const [linkedBaseMapId, setLinkedBaseMapId] = useState("");
  const [existingBaseMapId, setExistingBaseMapId] = useState("");
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

  // vertical base maps already holding a placement of ANOTHER live axis of
  // the scope (one placement per page per scope): not offered
  const blockedBaseMapIds = useLiveQuery(async () => {
    if (!projectId) return new Set();
    const rows = (
      await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter((a) => !a.deletedAt && a.type === "REVOLUTION_AXIS_PLACEMENT");
    const scopeIdByListingId = await getScopeIdByListingId(rows);
    const inScope = rows.filter((p) =>
      isRevolutionHelperInScope(p, { scopeId, scopeIdByListingId })
    );
    const axisIds = [
      ...new Set(inScope.map((p) => p.revolutionAxisId).filter(Boolean)),
    ];
    const axisRows = axisIds.length
      ? await db.annotations.bulkGet(axisIds)
      : [];
    const alive = new Set(
      (axisRows ?? []).filter((r) => r && !r.deletedAt).map((r) => r.id)
    );
    return new Set(
      inScope
        .filter((p) => p.revolutionAxisId && alive.has(p.revolutionAxisId))
        .map((p) => p.baseMapId)
    );
  }, [projectId, scopeId, annotationsUpdatedAt]);

  const existingGroups = useMemo(
    () =>
      (verticalGroups ?? [])
        .map((g) => ({
          listing: g.listing,
          baseMaps: g.baseMaps.filter((bm) => !blockedBaseMapIds?.has(bm.id)),
        }))
        .filter((g) => g.baseMaps.length > 0),
    [verticalGroups, blockedBaseMapIds]
  );

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
      setMode((prev) => (prev === "linked" ? "create" : prev));
    }
  }, [axisId, hasLinked, linkedBaseMaps, storedBaseMapId]);

  // Preselected axis already posed: straight to the cotes
  const [autoSkipped, setAutoSkipped] = useState(false);
  useEffect(() => {
    if (autoSkipped || !initialAxisId || !axis || !hasLinked) return;
    setAutoSkipped(true);
    setStep(2);
  }, [autoSkipped, initialAxisId, axis, hasLinked]);

  const verticalBaseMapId =
    mode === "linked"
      ? linkedBaseMapId || null
      : mode === "existing"
        ? existingBaseMapId || null
        : null;

  const canGoNext =
    Boolean(axis) &&
    !axis?.deletedAt &&
    (mode === "create" || Boolean(verticalBaseMapId));

  const setup = useMemo(
    () => ({ listingId, verticalBaseMapId }),
    [listingId, verticalBaseMapId]
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
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ pt: 1 }}>
          <FieldRevolutionAxisSelect
            value={axisId}
            onChange={(id) => setAxisId(id ?? "")}
            helperText={AXIS_HELPER}
          />
        </Box>

        {axis && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {LINKED_TITLE}
            </Typography>
            {hasLinked ? (
              <>
                {linkedBaseMaps.length === 1 ? (
                  <Typography variant="body2">
                    {LINKED_ONE_PREFIX}
                    {linkedBaseMaps[0].name ?? "Sans nom"}
                  </Typography>
                ) : (
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label={EXISTING_SELECT_LABEL}
                    value={linkedBaseMapId}
                    onChange={(e) => setLinkedBaseMapId(e.target.value)}
                  >
                    {linkedBaseMaps.map((bm) => (
                      <MenuItem key={bm.id} value={bm.id} dense>
                        {bm.name ?? "Sans nom"}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {LINKED_DESCRIPTION}
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {NO_LINKED_DESCRIPTION}
                </Typography>
                <RadioGroup
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <FormControlLabel
                    value="create"
                    control={<Radio size="small" />}
                    label={
                      <Typography variant="body2">{CREATE_LABEL}</Typography>
                    }
                  />
                  <FormControlLabel
                    value="existing"
                    control={<Radio size="small" />}
                    disabled={existingGroups.length === 0}
                    label={
                      <Typography variant="body2">
                        {existingGroups.length === 0
                          ? `${EXISTING_LABEL} — ${NO_EXISTING}`
                          : EXISTING_LABEL}
                      </Typography>
                    }
                  />
                </RadioGroup>
                {mode === "existing" && existingGroups.length > 0 && (
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label={EXISTING_SELECT_LABEL}
                    value={existingBaseMapId}
                    onChange={(e) => setExistingBaseMapId(e.target.value)}
                    helperText={EXISTING_HELPER}
                    sx={{ mt: 1 }}
                  >
                    {existingGroups.flatMap((g) => [
                      <ListSubheader key={`h-${g.listing.id}`}>
                        {g.listing.name}
                      </ListSubheader>,
                      ...g.baseMaps.map((bm) => (
                        <MenuItem key={bm.id} value={bm.id} dense>
                          {bm.name ?? "Sans nom"}
                        </MenuItem>
                      )),
                    ])}
                  </TextField>
                )}
              </>
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
