import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useProcedureOutputs from "Features/annotationsAuto/hooks/useProcedureOutputs";
import useRunProcedureReplacing from "Features/annotationsAuto/hooks/useRunProcedureReplacing";
import getProcedureOutputs from "Features/annotationsAuto/services/getProcedureOutputs";
import RowProcedureRun from "Features/annotationsAuto/components/RowProcedureRun";
import DialogProcedureAxisLaunch from "./DialogProcedureAxisLaunch";
import useListingsLinkedToAxis from "../hooks/useListingsLinkedToAxis";
import getRevolutionAxisProcedures, {
  getAxisSystemListingId,
} from "../utils/getRevolutionAxisProcedures";

// strings

const launchS = "Lancer";
const updateS = "Mettre à jour (supprimer puis relancer)";
const deleteS = (n) => `Supprimer les ${n} annotation(s) créée(s)`;
const deletedS = (n) => `${n} annotation(s) supprimée(s)`;

// Section of the REVOLUTION_AXIS edit toolbar: the procedures already bound
// to the axis from a listing « Dessin auto » band — one launcher line each:
//
// - the systems launched ON the axis (château d'eau GO, réservoir — the cotes
//   dialog stored the launching listing in procedureParams[key].listingId):
//   play / refresh reopens DialogProcedureAxisLaunch on that listing with
//   the axis preselected, the delete button sweeps the outputs;
// - the listing procedures bound to the axis through their axis parameter
//   (château d'eau surfaces, listing.procedureParams[key].axisId): play /
//   refresh runs them right away (replace-on-rerun), delete sweeps.
//
// An axis bound to nothing shows no section at all: a system is bound from
// its listing, never from the axis.
export default function SectionRevolutionAxisSystems({ axisId }) {
  // data

  const appConfig = useAppConfig();
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const axis = useLiveQuery(
    () => (axisId ? db.annotations.get(axisId) : null),
    [axisId, annotationsUpdatedAt]
  );

  const axisProcedures = useMemo(
    () =>
      getRevolutionAxisProcedures(appConfig?.automatedAnnotationsProcedures),
    [appConfig?.automatedAnnotationsProcedures]
  );

  // systems launched on the axis whose listing is still alive
  const systems = useLiveQuery(async () => {
    if (!axis) return [];
    const items = [];
    for (const procedure of axisProcedures) {
      const listingId = getAxisSystemListingId(axis, procedure.key);
      if (!listingId) continue;
      const listing = await db.listings.get(listingId);
      if (!listing || listing.deletedAt) continue;
      items.push({ procedure, listing });
    }
    return items;
  }, [axis, axisProcedures]);

  const linkedListings = useListingsLinkedToAxis(axis?.id);

  // render

  if (!axis || axis.deletedAt) return null;
  const hasRows = (systems?.length ?? 0) > 0 || linkedListings.length > 0;
  if (!hasRows) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 0.5 }}>
      {(systems ?? []).map(({ procedure, listing }) => (
        <RowAxisSystem
          key={procedure.key}
          axis={axis}
          procedure={procedure}
          listing={listing}
        />
      ))}
      {linkedListings.map(({ procedure, listing }) => (
        <RowAxisListingProcedure
          key={`${procedure.key}:${listing.id}`}
          axis={axis}
          procedure={procedure}
          listing={listing}
        />
      ))}
    </Box>
  );
}

// Shared delete of the outputs of a procedure run from the axis.
function useDeleteAxisOutputs({ axis, procedure }) {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const deleteAnnotations = useDeleteAnnotations();

  return async () => {
    const rows = await getProcedureOutputs({
      projectId,
      procedureKey: procedure.key,
      sourceAnnotationIds: [axis.id],
      chainedProcedureKeys: procedure.chainedProcedureKeys,
      procedures: appConfig?.automatedAnnotationsProcedures,
    });
    const ids = rows.map((a) => a.id);
    if (ids.length === 0) return;
    await deleteAnnotations(ids);
    dispatch(setToaster({ message: deletedS(ids.length) }));
  };
}

function RowAxisSystem({ axis, procedure, listing }) {
  const outputs = useProcedureOutputs({
    procedureKey: procedure.key,
    sourceAnnotationIds: [axis.id],
  });
  const deleteOutputs = useDeleteAxisOutputs({ axis, procedure });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasOutputs = outputs.length > 0;

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteOutputs();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RowProcedureRun
        caption={listing.name}
        label={procedure.label}
        hasOutputs={hasOutputs}
        busy={busy}
        playTitle={hasOutputs ? updateS : launchS}
        deleteTitle={deleteS(outputs.length)}
        onPlay={() => setDialogOpen(true)}
        onDelete={handleDelete}
      />
      {dialogOpen && (
        <DialogProcedureAxisLaunch
          open
          procedure={procedure}
          listingId={listing.id}
          initialAxisId={axis.id}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}

function RowAxisListingProcedure({ axis, procedure, listing }) {
  const runReplacing = useRunProcedureReplacing();
  const outputs = useProcedureOutputs({
    procedureKey: procedure.key,
    sourceAnnotationIds: [axis.id],
  });
  const deleteOutputs = useDeleteAxisOutputs({ axis, procedure });
  const [busy, setBusy] = useState(false);
  const hasOutputs = outputs.length > 0;

  async function handlePlay() {
    if (busy) return;
    setBusy(true);
    try {
      await runReplacing({
        procedureKey: procedure.key,
        sourceAnnotationIds: [axis.id],
        procedureParams: {
          ...(listing.procedureParams?.[procedure.key] ?? {}),
          listingId: listing.id,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteOutputs();
    } finally {
      setBusy(false);
    }
  }

  return (
    <RowProcedureRun
      caption={listing.name}
      label={procedure.label}
      hasOutputs={hasOutputs}
      busy={busy}
      playTitle={hasOutputs ? updateS : launchS}
      deleteTitle={deleteS(outputs.length)}
      onPlay={handlePlay}
      onDelete={handleDelete}
    />
  );
}
