import { lazy, Suspense, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { setPendingProcedureLaunch } from "../annotationsAutoSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useObjectsTargetListings from "Features/objectsLibrary/hooks/useObjectsTargetListings";
import useCreateListingForObjects from "Features/objectsLibrary/hooks/useCreateListingForObjects";
import useEnsureSystemTemplatesInListing from "Features/objectsLibrary/hooks/useEnsureSystemTemplatesInListing";
import notifyProcedureRunResult from "../utils/notifyProcedureRunResult";
import getProcedureOutputs from "../services/getProcedureOutputs";

// strings

const CREATE_LISTING_ERROR = "Création du listing impossible.";
const PREPARE_TEMPLATES_ERROR =
  "Impossible de préparer les modèles du système.";

/**
 * Auto-open of a procedure params dialog right after its source annotation is
 * drawn: the commit arms `annotationsAuto.pendingProcedureLaunch` when the
 * source template links a procedure flagged `launchOnSourceCreated` in the
 * registry (useHandleCommitDrawing); this outlet — mounted once in
 * MainMapEditorV3, MAP viewer only — lazy-loads the entry's `paramsDialog`
 * (same generic contract as ProcedureActionButtons) and runs the procedure on
 * confirm. Cancelling just clears the pending launch: the axis stays, the
 * manual toolbar Play remains available.
 *
 * The same pending launch is armed by the "Associer un système à l'axe"
 * flow and the axis row "…" menu, possibly on a source that already carries
 * outputs of this procedure: the confirm is replace-on-rerun — the previous
 * outputs are deleted BEFORE the new run commits, like the launcher
 * "Relancer" — so a launch never stacks a second drawing on the first.
 *
 * A pending launch armed by "Associer un système à l'axe" also carries
 * `systemSetup` { object, templates, listing: { id } | { name } }: the
 * destination of the system's generated templates, materialized HERE on
 * "Lancer" only — the listing is created when named (reused when the scope
 * already holds one of that name), the missing templates are created in it
 * (useEnsureSystemTemplatesInListing) — so cancelling the cotes dialog
 * leaves the scope untouched.
 */
export default function ProcedureAutoLaunchDialogOutlet() {
  const dispatch = useDispatch();

  // data

  const pending = useSelector((s) => s.annotationsAuto.pendingProcedureLaunch);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const run = useAnnotationsAutoRun();
  const deleteAnnotations = useDeleteAnnotations();
  const scopeListings = useObjectsTargetListings();
  const createListing = useCreateListingForObjects();
  const ensureTemplates = useEnsureSystemTemplatesInListing();

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

  // Destination listing of a system setup: the picked listing, else the
  // scope listing already named like the target, else a new one.
  async function resolveSystemListingId(listing) {
    if (listing?.id) return listing.id;
    const name = (listing?.name ?? "").trim();
    if (!name) return null;
    const existing = (scopeListings ?? []).find(
      (l) => (l.name ?? "").trim() === name
    );
    if (existing) return existing.id;
    const created = await createListing(name);
    return created?.id ?? null;
  }

  // Materialize the system setup (listing + generated templates) before the
  // run. Returns false when the run must not start.
  async function applySystemSetup(systemSetup) {
    if (!systemSetup) return true;
    try {
      const listingId = await resolveSystemListingId(systemSetup.listing);
      if (!listingId) {
        dispatch(
          setToaster({ message: CREATE_LISTING_ERROR, severity: "warning" })
        );
        return false;
      }
      await ensureTemplates({
        object: systemSetup.object,
        templates: systemSetup.templates,
        listingId,
      });
      return true;
    } catch (e) {
      console.error("[ProcedureAutoLaunchDialogOutlet] system setup failed", e);
      dispatch(
        setToaster({ message: PREPARE_TEMPLATES_ERROR, severity: "error" })
      );
      return false;
    }
  }

  async function handleConfirm(procedureParams) {
    const { procedureKey, sourceAnnotationId, systemSetup } = pending;
    clearPending();
    if (!(await applySystemSetup(systemSetup))) return;
    const previousOutputs = await getProcedureOutputs({
      projectId,
      procedureKey,
      sourceAnnotationIds: [sourceAnnotationId],
    });
    if (previousOutputs.length > 0) {
      await deleteAnnotations(previousOutputs.map((a) => a.id));
    }
    const result = await run({
      procedureKey,
      sourceAnnotationIds: [sourceAnnotationId],
      // fallback source tag for annotations the procedure leaves untagged;
      // reset/refresh match by source-id set membership (see
      // ProcedureActionButtons).
      autoCreatedFrom: sourceAnnotationId,
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
