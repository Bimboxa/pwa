import { lazy, Suspense, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { setPendingProcedureLaunch } from "../annotationsAutoSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";
import notifyProcedureRunResult from "../utils/notifyProcedureRunResult";

/**
 * Auto-open of a procedure params dialog right after its source annotation is
 * drawn: the commit arms `annotationsAuto.pendingProcedureLaunch` when the
 * source template links a procedure flagged `launchOnSourceCreated` in the
 * registry (useHandleCommitDrawing); this outlet — mounted once in
 * MainMapEditorV3, MAP viewer only — lazy-loads the entry's `paramsDialog`
 * (same generic contract as ProcedureActionButtons) and runs the procedure on
 * confirm. Cancelling just clears the pending launch: the axis stays, the
 * manual toolbar Play remains available.
 */
export default function ProcedureAutoLaunchDialogOutlet() {
  const dispatch = useDispatch();

  // data

  const pending = useSelector((s) => s.annotationsAuto.pendingProcedureLaunch);
  const appConfig = useAppConfig();
  const run = useAnnotationsAutoRun();

  const entry = (appConfig?.automatedAnnotationsProcedures ?? []).find(
    (p) => p.key === pending?.procedureKey
  );
  const paramsDialogLoader = entry?.paramsDialog;
  const ParamsDialog = useMemo(
    () => (paramsDialogLoader ? lazy(paramsDialogLoader) : null),
    [paramsDialogLoader]
  );

  const annotation = useLiveQuery(async () => {
    if (!pending?.sourceAnnotationId) return null;
    return db.annotations.get(pending.sourceAnnotationId);
  }, [pending?.sourceAnnotationId]);

  // handlers

  function clearPending() {
    dispatch(setPendingProcedureLaunch(null));
  }

  async function handleConfirm(procedureParams) {
    clearPending();
    const result = await run({
      procedureKey: pending.procedureKey,
      sourceAnnotationIds: [pending.sourceAnnotationId],
      // fallback source tag for annotations the procedure leaves untagged;
      // reset/refresh match by source-id set membership (see
      // ProcedureActionButtons).
      autoCreatedFrom: pending.sourceAnnotationId,
      procedureParams,
    });
    notifyProcedureRunResult(dispatch, result);
  }

  // render

  // annotation guard: a stale id (deleted source, project switch) must not
  // mount the dialog — with annotation=null it would fall into its legacy
  // (non-axis) layout.
  if (!pending || !ParamsDialog || !annotation || annotation.deletedAt)
    return null;

  return (
    <Suspense fallback={null}>
      <ParamsDialog
        open
        annotation={annotation}
        onClose={clearPending}
        onConfirm={handleConfirm}
      />
    </Suspense>
  );
}
