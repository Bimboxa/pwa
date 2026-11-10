import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";
import {
  setListingActiveProcedureKey,
  setPendingProcedureLaunch,
} from "../annotationsAutoSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useDeleteProcedureOutputs from "../hooks/useDeleteProcedureOutputs";
import useListingProcedureSourceIds from "../hooks/useListingProcedureSourceIds";
import useProcedureOutputs from "../hooks/useProcedureOutputs";
import useProcedurePaintOutputs from "../hooks/useProcedurePaintOutputs";
import useRunProcedureReplacing from "../hooks/useRunProcedureReplacing";
import setListingProcedureParams from "../services/setListingProcedureParams";
import {
  formatDeleteOutputsTitle,
  formatDeletedOutputsMessage,
} from "../utils/formatProcedureOutputsCount";
import {
  getAxisParamOfProcedure,
  getAxisSystemListingId,
} from "Features/revolutionAxes/utils/getRevolutionAxisProcedures";
import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { ExpandMore } from "@mui/icons-material";

import DialogProcedureLaunch from "./DialogProcedureLaunch";
import RowProcedureRun from "./RowProcedureRun";
import DialogProcedureAxisLaunch from "Features/revolutionAxes/components/DialogProcedureAxisLaunch";
import FieldRevolutionAxisSelect from "Features/revolutionAxes/components/FieldRevolutionAxisSelect";
import DialogPromptIa from "Features/promptIa/components/DialogPromptIa";
import getPromptIaOutputs from "Features/promptIa/services/getPromptIaOutputs";
import {
  PROMPT_IA_PROCEDURE,
  isPromptIaProcedure,
} from "Features/promptIa/utils/promptIaProcedure";

const EMPTY = [];

/**
 * "Dessin auto" section of a listing, for the procedures linked to it
 * (`listing.procedureKeys`, edited in the listing properties), on one line:
 * active procedure name — launch button — procedure selector (only when the
 * listing links several procedures). Four launch flavours:
 *
 * - revolution-axis system (registry `sourceAnnotationTypes` REVOLUTION_AXIS
 *   + `paramsDialog` — château d'eau GO, réservoir): the play button opens
 *   DialogProcedureAxisLaunch (axis + vertical page, then cotes; create /
 *   update / delete per axis live in that dialog). The line reads "update"
 *   as soon as one axis launched from this listing carries outputs;
 * - listing parameters (registry `listingParams`, e.g. the axis the château
 *   d'eau surfaces revolve around): the parameters are edited right under
 *   the line (listing.procedureParams[key]) and the play button runs the
 *   procedure straight away, replace-on-rerun, the axis as source;
 * - drawn source (registry `drawSourceOnLaunch` + `launchOnSourceCreated` +
 *   `paramsDialog` — e.g. the reference segment of a pool): with no source
 *   on the base map yet, the play button ARMS THE DRAWING of the source
 *   template (the listing template linking the procedure through its
 *   `procedureKeys`); committing it auto-opens the params dialog
 *   (useHandleCommitDrawing → ProcedureAutoLaunchDialogOutlet). With exactly
 *   one source, the play button reopens that dialog on it (update). Several
 *   sources fall back to the default dialog below;
 * - direct launch (registry `directLaunch` — a procedure without any option
 *   to pick, e.g. the pool « Quantités clé »): the play / refresh button
 *   runs it straight away on the listing's sources, replace-on-rerun;
 * - otherwise the play button opens DialogProcedureLaunch (procedure
 *   properties, number of source annotations concerned, launch buttons),
 *   sources from useListingProcedureSourceIds.
 *
 * While the procedure has live outputs from its sources — annotations
 * (getProcedureOutputs) or, for a procedure that paints (registry
 * `outputKind: "MESH_PAINTS"`), painted parts (getProcedurePaintOutputs) —
 * the line reads "update" (refresh icon) instead of "play" and a delete
 * button sweeps those outputs (useDeleteProcedureOutputs, same scope as the
 * reset of ProcedureActionButtons).
 *
 * A listing whose Prompt IA is enabled (listing.promptIaEnabled) also lists
 * the virtual "Prompt IA" procedure: no sources, its play button opens
 * DialogPromptIa (zip download, result import). Its outputs are the
 * annotations the Prompt IA created on the base map and that the user has
 * not edited since (getPromptIaOutputs): the delete button sweeps them.
 *
 * Renders nothing when the listing links no procedure.
 */
export default function SectionListingProcedures({ listingId, baseMapId, sx }) {
  const dispatch = useDispatch();

  // strings

  const launchS = "Lancer la procédure";
  const openPromptIaS = "Ouvrir le Prompt IA";
  const updateS = "Mettre à jour (supprimer puis relancer)";
  const selectS = "Choisir la procédure";
  const missingParamsS = "Choisissez d'abord les paramètres de la procédure";
  const drawSourceS = "Dessiner l'annotation de départ";
  const noSourceTemplateS =
    "Aucun modèle de la liste n'est lié à cette procédure.";
  const drawIn2dS =
    "Passez dans l'éditeur 2D pour dessiner l'annotation de départ.";
  const noSourceS =
    "Aucune annotation de départ sur ce fond de plan pour cette procédure.";

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const listing = useLiveQuery(
    () => (listingId ? db.listings.get(listingId) : null),
    [listingId]
  );

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const deleteAnnotations = useDeleteAnnotations();
  const deleteOutputs = useDeleteProcedureOutputs();
  const runReplacing = useRunProcedureReplacing();
  const axes = useRevolutionAxes();
  // the drawn-source launch arms a 2D draw (its commit opens the dialog)
  const isThreedToggledEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // shared with the annotation toolbar band (RowProcedureActionAuto)
  const activeKey = useSelector(
    (s) => s.annotationsAuto.activeProcedureKeyByListingId[listingId]
  );

  // state

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // helpers

  const registryProcedures = (listing?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasRegistryProcedures = registryProcedures.length > 0;
  const linkedProcedures = listing?.promptIaEnabled
    ? [...registryProcedures, PROMPT_IA_PROCEDURE]
    : registryProcedures;
  const hasProcedures = linkedProcedures.length > 0;
  const procedure =
    linkedProcedures.find((p) => p.key === activeKey) ?? linkedProcedures[0];
  const isPromptIa = isPromptIaProcedure(procedure);
  const showSelector = linkedProcedures.length > 1;

  const isAxisSystem =
    !isPromptIa &&
    Boolean(procedure?.paramsDialog) &&
    (procedure?.sourceAnnotationTypes ?? []).includes("REVOLUTION_AXIS");
  // source drawn at launch, its commit auto-opening the params dialog
  const isDrawnSourceSystem =
    !isPromptIa &&
    !isAxisSystem &&
    Boolean(procedure?.drawSourceOnLaunch) &&
    Boolean(procedure?.launchOnSourceCreated) &&
    Boolean(procedure?.paramsDialog);
  // no option to pick: play / refresh run straight away
  const isDirectLaunch =
    !isPromptIa &&
    !isAxisSystem &&
    !isDrawnSourceSystem &&
    Boolean(procedure?.directLaunch);
  const axisParam = !isPromptIa ? getAxisParamOfProcedure(procedure) : null;
  const listingParams = procedure?.listingParams ?? EMPTY;
  const hasListingParams = !isPromptIa && listingParams.length > 0;
  const paramValues = listing?.procedureParams?.[procedure?.key] ?? {};
  const missingRequiredParam = listingParams.some(
    (p) => p.required !== false && !paramValues[p.key]
  );

  // data - sources of the active procedure
  //  - axis system: the axes launched from this listing (association mark);
  //  - listing params: the chosen axis;
  //  - default: useListingProcedureSourceIds; none for the Prompt IA.

  const getSourceAnnotationIds = useListingProcedureSourceIds({
    listingId,
    baseMapId,
    enabled: hasRegistryProcedures && !isAxisSystem && !hasListingParams,
  });

  let sourceAnnotationIds = EMPTY;
  if (isAxisSystem) {
    sourceAnnotationIds = axes
      .filter((a) => getAxisSystemListingId(a, procedure.key) === listingId)
      .map((a) => a.id);
  } else if (hasListingParams) {
    const axisId = axisParam ? paramValues[axisParam.key] : null;
    sourceAnnotationIds = axisId ? [axisId] : EMPTY;
  } else if (procedure && !isPromptIa) {
    sourceAnnotationIds = getSourceAnnotationIds(procedure);
  }

  // data - live outputs (display only: the delete / relaunch re-read them
  // from Dexie at call time)

  const procedureOutputs = useProcedureOutputs({
    procedureKey: isPromptIa ? null : procedure?.key,
    sourceAnnotationIds,
  });
  const promptIaOutputs = useLiveQuery(
    () => (isPromptIa ? getPromptIaOutputs({ listingId, baseMapId }) : EMPTY),
    [isPromptIa, listingId, baseMapId, annotationsUpdatedAt]
  );
  const paintOutputs = useProcedurePaintOutputs({
    procedureKey: isPromptIa ? null : procedure?.key,
    sourceAnnotationIds,
  });
  const createdAnnotations = isPromptIa
    ? (promptIaOutputs ?? EMPTY)
    : procedureOutputs;
  const createdCount = createdAnnotations.length;
  const paintedCount = isPromptIa ? 0 : paintOutputs.length;
  const hasOutputs = createdCount + paintedCount > 0;
  const deleteS = isPromptIa
    ? `Supprimer les ${createdCount} annotation(s) créée(s) par le Prompt IA (non modifiées depuis)`
    : formatDeleteOutputsTitle({
        annotations: createdCount,
        paints: paintedCount,
      });

  // handlers

  function handleSelect(key) {
    dispatch(setListingActiveProcedureKey({ listingId, procedureKey: key }));
    setMenuAnchorEl(null);
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      if (!isPromptIa) {
        const message = formatDeletedOutputsMessage(
          await deleteOutputs({
            procedureKey: procedure.key,
            sourceAnnotationIds,
          })
        );
        if (message) dispatch(setToaster({ message }));
        return;
      }
      const outputs = await getPromptIaOutputs({ listingId, baseMapId });
      const ids = outputs.map((a) => a.id);
      if (ids.length === 0) return;
      await deleteAnnotations(ids);
      dispatch(
        setToaster({ message: `${ids.length} annotation(s) supprimée(s)` })
      );
    } finally {
      setBusy(false);
    }
  }

  // Drawn-source launch with no source yet: arm the drawing of the listing
  // template that links the procedure (same link the commit reads to
  // auto-open the params dialog).
  async function armSourceDrawing() {
    if (isThreedToggledEditor) {
      dispatch(setToaster({ message: drawIn2dS, severity: "warning" }));
      return;
    }
    const templates = (
      await db.annotationTemplates
        .where("listingId")
        .equals(listingId)
        .toArray()
    ).filter((t) => !t.deletedAt);
    const template = templates.find((t) =>
      (t.procedureKeys ?? []).includes(procedure.key)
    );
    const activeTool = template
      ? resolveActiveToolForTemplate(template, null)
      : null;
    if (!template || !activeTool) {
      dispatch(setToaster({ message: noSourceTemplateS, severity: "warning" }));
      return;
    }
    startDrawFromTemplate(dispatch, { template, listingId, activeTool });
  }

  async function handlePlay() {
    if (busy) return;
    if (isDrawnSourceSystem && sourceAnnotationIds.length === 0) {
      await armSourceDrawing();
      return;
    }
    if (isDrawnSourceSystem && sourceAnnotationIds.length === 1) {
      // params dialog on the existing source (replace-on-rerun)
      dispatch(
        setPendingProcedureLaunch({
          procedureKey: procedure.key,
          sourceAnnotationId: sourceAnnotationIds[0],
        })
      );
      return;
    }
    if (isDirectLaunch) {
      if (sourceAnnotationIds.length === 0) {
        dispatch(setToaster({ message: noSourceS, severity: "warning" }));
        return;
      }
      setBusy(true);
      try {
        await runReplacing({
          procedureKey: procedure.key,
          sourceAnnotationIds,
        });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!hasListingParams) {
      setLaunchOpen(true);
      return;
    }
    if (missingRequiredParam) {
      dispatch(setToaster({ message: missingParamsS, severity: "warning" }));
      return;
    }
    setBusy(true);
    try {
      await runReplacing({
        procedureKey: procedure.key,
        sourceAnnotationIds,
        procedureParams: { ...paramValues, listingId },
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleParamChange(paramKey, value) {
    await setListingProcedureParams(listingId, procedure.key, {
      [paramKey]: value,
    });
  }

  // render

  if (!hasProcedures) return null;

  const playTitle = isPromptIa
    ? openPromptIaS
    : isDrawnSourceSystem && sourceAnnotationIds.length === 0
      ? drawSourceS
      : hasOutputs
        ? updateS
        : launchS;

  return (
    // white band around the tinted section
    <Box sx={{ bgcolor: "background.paper", px: 1, py: 0.75, ...sx }}>
      <RowProcedureRun
        label={procedure.label}
        hasOutputs={hasOutputs}
        busy={busy}
        // the Prompt IA zip is built from the displayed base map
        playDisabled={isPromptIa && !baseMapId}
        playTitle={playTitle}
        deleteTitle={deleteS}
        onPlay={handlePlay}
        // per-axis delete lives in the axis launch dialog
        onDelete={isAxisSystem ? null : handleDelete}
        actions={
          showSelector ? (
            <Tooltip title={selectS}>
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchorEl(e.currentTarget)}
              >
                <ExpandMore sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          ) : null
        }
      >
        {hasListingParams
          ? listingParams.map((param) =>
              param.type === "REVOLUTION_AXIS" ? (
                <FieldRevolutionAxisSelect
                  key={param.key}
                  value={paramValues[param.key] ?? ""}
                  onChange={(id) => handleParamChange(param.key, id)}
                  label={param.label}
                  disabled={busy}
                  sx={{ bgcolor: "background.paper", borderRadius: 1 }}
                />
              ) : null
            )
          : null}
      </RowProcedureRun>

      {showSelector && (
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {linkedProcedures.map((p) => (
            <MenuItem
              key={p.key}
              dense
              selected={p.key === procedure.key}
              onClick={() => handleSelect(p.key)}
            >
              {p.label}
            </MenuItem>
          ))}
        </Menu>
      )}

      {launchOpen && isPromptIa && (
        <DialogPromptIa
          key={procedure.key}
          open={launchOpen}
          onClose={() => setLaunchOpen(false)}
          listingId={listingId}
          baseMapId={baseMapId}
        />
      )}

      {launchOpen && isAxisSystem && (
        <DialogProcedureAxisLaunch
          key={procedure.key}
          open={launchOpen}
          onClose={() => setLaunchOpen(false)}
          procedure={procedure}
          listingId={listingId}
        />
      )}

      {launchOpen && !isPromptIa && !isAxisSystem && (
        <DialogProcedureLaunch
          // per-procedure instance: no dialog state carried over when the
          // active procedure changes
          key={procedure.key}
          open={launchOpen}
          onClose={() => setLaunchOpen(false)}
          procedure={procedure}
          listingId={listingId}
          baseMapId={baseMapId}
          sourceAnnotationIds={sourceAnnotationIds}
        />
      )}
    </Box>
  );
}
