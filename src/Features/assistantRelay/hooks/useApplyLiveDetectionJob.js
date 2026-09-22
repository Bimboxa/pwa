import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import db from "App/db/db";
import { assertAiTaskTarget } from "Features/aiTasks/utils/aiTaskSource";
import editor from "App/editor";
import { setToaster } from "Features/layout/layoutSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import {
  setOpenedPanel,
  setSelectedListingId,
} from "Features/listings/listingsSlice";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useCreateAnnotationListing from "Features/listings/hooks/useCreateAnnotationListing";
import useDeleteListing from "Features/listings/hooks/useDeleteListing";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";
import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";

import { upsertAssistantRelayJobs } from "../assistantRelaySlice";
import {
  ackJob,
  claimJob,
  describeRelayError,
  fetchJob,
} from "../services/assistantRelayClient";
import { loadTargetBaseMap } from "./useImportDetectionJob";

// Centre of what the user is looking at, in base map pixels. Written by
// InteractionLayer on every camera change (base-map local px); falls back to
// the image centre when the editor has not reported a viewport yet.
function getViewportCenter(baseMap) {
  const bounds = editor?.viewportInBase?.bounds;
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  const size = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  if (size?.width > 0 && size?.height > 0) {
    return { x: size.width / 2, y: size.height / 2 };
  }
  return null;
}

function liveError(code, message) {
  const e = new Error(message ?? code);
  e.code = code;
  return e;
}

// Applies the LIVE jobs of the ChatGPT relay (mode `live`: draw / create
// templates / create an annotations list, mode `live_undo`: remove what a
// live job created) as soon as
// they are seen — no confirmation. One tab claims the job on the relay
// (`proposed → applying`, atomic) before touching the DB, then acks
// `imported` with a `result` the model reads back.
export default function useApplyLiveDetectionJob() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const mainBaseMap = useMainBaseMap();
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  const deleteAnnotations = useDeleteAnnotations();
  const { value: scope } = useSelectedScope();
  const createAnnotationListing = useCreateAnnotationListing();
  const deleteListing = useDeleteListing();

  // Latest values for the async handler (jobs arrive while the user pans,
  // switches base map or listing).
  const latest = useRef({});
  useEffect(() => {
    latest.current = {
      projectId,
      selectedBaseMapId,
      selectedListingId,
      mainBaseMap,
      listings,
      scope,
      // Fresh function identities on every render: read through the ref so
      // the handlers below stay stable.
      createAnnotationListing,
      deleteListing,
    };
  });

  // Jobs this tab already tried (claim lost, applied or failed): never twice.
  const attemptedRef = useRef(new Set());

  // Target listing of a live job. `listing.id` (explicit target, e.g. a list
  // a previous job created) wins; otherwise the selected listing, the
  // snapshot's one, or the first of the scope.
  const resolveListingId = useCallback(async (snapshot, listing) => {
    const { projectId, selectedListingId, listings } = latest.current;
    const ids = new Set((listings ?? []).map((l) => l.id));
    if (listing?.id) {
      if (ids.has(listing.id)) return listing.id;
      // The Redux mirror lags behind Dexie: a list created by the previous
      // job may not be there yet.
      const row = await db.listings.get(listing.id);
      const isTarget =
        row &&
        !row.deletedAt &&
        row.projectId === projectId &&
        (row.entityModel?.type ?? "LOCATED_ENTITY") === "LOCATED_ENTITY";
      if (!isTarget) throw liveError("LISTING_NOT_FOUND", listing.id);
      return row.id;
    }
    if (selectedListingId && ids.has(selectedListingId))
      return selectedListingId;
    if (snapshot?.listingId && ids.has(snapshot.listingId))
      return snapshot.listingId;
    return listings?.[0]?.id ?? null;
  }, []);

  // mode `live`: create the listing the job asks for (`listing.name`), then
  // place the payload (annotations and/or templates) in the target listing.
  const applyDraw = useCallback(
    async (full) => {
      const {
        projectId,
        selectedBaseMapId,
        mainBaseMap,
        scope,
        createAnnotationListing,
      } = latest.current;

      // A new list without templates carries an empty payload, which the
      // import parser refuses: nothing to parse nor to place then.
      const payload = full.payload ?? {};
      const isEmpty =
        !(payload.annotationTemplates ?? []).length &&
        !(payload.annotations ?? []).length;
      let data = null;
      if (!isEmpty) {
        const parsed = parseImportAnnotationsJson(JSON.stringify(payload));
        if (!parsed.ok) throw liveError("INVALID_PAYLOAD", parsed.error);
        data = parsed.data;
      }
      const hasAnnotations = (data?.annotations ?? []).length > 0;

      const newListingName = (full.listing?.name ?? "").trim() || null;
      if (isEmpty && !newListingName) throw liveError("INVALID_PAYLOAD");

      // Everything that can fail is checked BEFORE the listing is created.
      let listingId = null;
      if (newListingName) {
        if (!scope?.id) throw liveError("NO_SCOPE");
      } else {
        listingId = await resolveListingId(full.snapshot, full.listing);
        if (!listingId) throw liveError("NO_LISTING");
      }

      const placement = full.placement?.mode ?? "viewport_center";
      let targetBaseMap = null;
      let relativeToBaseMap = false;
      let targetCenter = null;
      if (!isEmpty) {
        if (placement === "absolute") {
          // Coordinates are on the snapshot image: that base map, wherever
          // it is.
          targetBaseMap = await loadTargetBaseMap(full, projectId);
          assertAiTaskTarget(targetBaseMap, full.payload);
          if (full.payload?.aiTaskTemplateIds?.length) {
            const mapped = await db.annotationTemplates.bulkGet(
              full.payload.aiTaskTemplateIds
            );
            if (
              mapped.some(
                (t) =>
                  !t ||
                  t.deletedAt ||
                  t.projectId !== projectId ||
                  t.listingId !== listingId ||
                  (t.type ?? t.drawingShape) !==
                    full.payload.annotationTemplates.find(
                      (template) => template.id === t.id
                    )?.type
              )
            )
              throw liveError(
                "AI_TASK_MAPPING_CHANGED",
                "Un modèle associé a été supprimé ou déplacé. Rouvrez la tâche pour vérifier les correspondances."
              );
          }
          relativeToBaseMap = true;
        } else {
          // The base map the user is looking at; real-world sizes are
          // rescaled with its own scale (widthMeters of the payload vs its
          // meterByPx).
          targetBaseMap = mainBaseMap;
          if (!targetBaseMap?.id) throw liveError("NO_BASE_MAP");
          if (hasAnnotations && !(targetBaseMap.getMeterByPx?.() > 0)) {
            throw liveError("TARGET_NOT_CALIBRATED");
          }
          // A templates-only job places nothing: no viewport needed.
          if (hasAnnotations && placement === "viewport_center") {
            targetCenter = getViewportCenter(targetBaseMap);
            if (!targetCenter) throw liveError("NO_BASE_MAP");
          }
        }
      }

      let created = null;
      if (newListingName) {
        created = await createAnnotationListing({
          name: newListingName,
          props: { relayJobId: full.jobId },
        });
        if (!created?.id) throw liveError("LISTING_NOT_CREATED");
        // Not in the Redux mirror yet: use the id directly.
        listingId = created.id;
      }

      let result = { placed: [], createdTemplateIds: [], armed: false };
      if (!isEmpty) {
        try {
          result = await importAnnotationsInlineJsonService({
            data,
            projectId,
            listingId,
            mainBaseMap: targetBaseMap,
            widthMeters: data?.image?.widthMeters ?? null,
            relativeToBaseMap,
            preserveIds: true,
            targetCenter,
            annotationProps: { relayJobId: full.jobId },
            templateProps: { relayJobId: full.jobId },
            dispatch,
          });
        } catch (e) {
          // No half-made list: drop the listing this job just created (and
          // the templates it may already hold).
          if (created) {
            try {
              await db.annotationTemplates
                .where("relayJobId")
                .equals(full.jobId)
                .delete();
              await db.listings.delete(created.id);
            } catch (rollbackError) {
              console.log("[assistantRelay] listing rollback", rollbackError);
            }
          }
          throw e;
        }
      }

      if (created) {
        // Same as DialogCreateListing: show the new list.
        dispatch(setSelectedListingId(created.id));
        dispatch(setOpenedPanel("LISTING"));
      }

      if (
        targetBaseMap &&
        placement === "absolute" &&
        targetBaseMap.id !== selectedBaseMapId
      ) {
        dispatch(setSelectedMainBaseMapId(targetBaseMap.id));
      }

      return {
        annotationIds: (result.placed ?? []).map((a) => a.id),
        templateIds: result.createdTemplateIds ?? [],
        baseMapId: targetBaseMap?.id ?? null,
        listingId,
        ...(created
          ? { createdListingId: created.id, listingName: created.name }
          : {}),
        placement,
        armed: Boolean(result.armed),
      };
    },
    [dispatch, resolveListingId]
  );

  // mode `live_undo`: delete what job `undoOf` created (annotations, its
  // templates when nothing else uses them, and the list it created when it
  // is empty afterwards).
  const applyUndo = useCallback(
    async (full) => {
      const undoOf = full.undoOf;
      if (!undoOf) throw liveError("INVALID_PAYLOAD", "undoOf manquant");
      const annotations = await db.annotations
        .where("relayJobId")
        .equals(undoOf)
        .filter((a) => !a.deletedAt)
        .toArray();
      const annotationIds = annotations.map((a) => a.id);
      if (annotationIds.length) await deleteAnnotations(annotationIds);

      const templates = await db.annotationTemplates
        .where("relayJobId")
        .equals(undoOf)
        .filter((t) => !t.deletedAt)
        .toArray();
      const deletedTemplateIds = [];
      const keptTemplateIds = [];
      for (const t of templates) {
        const used = await db.annotations
          .where("annotationTemplateId")
          .equals(t.id)
          .filter((a) => !a.deletedAt)
          .count();
        if (used > 0) {
          keptTemplateIds.push(t.id);
          continue;
        }
        await db.annotationTemplates.delete(t.id);
        deletedTemplateIds.push(t.id);
      }
      if (templates.length) dispatch(triggerAnnotationTemplatesUpdate());

      // The list the job created (`relayJobId` on the listing row; no index,
      // the table is small): removed only when nothing is left in it.
      const createdListings = await db.listings
        .filter((l) => l.relayJobId === undoOf && !l.deletedAt)
        .toArray();
      const deletedListingIds = [];
      const keptListingIds = [];
      const countAlive = (table, listingId) =>
        table
          ? table
              .where("listingId")
              .equals(listingId)
              .filter((r) => !r.deletedAt)
              .count()
          : 0;
      for (const l of createdListings) {
        const counts = await Promise.all([
          countAlive(db.annotations, l.id),
          countAlive(db.annotationTemplates, l.id),
          countAlive(db[l.table ?? "entities"], l.id),
        ]);
        if (counts.some((n) => n > 0)) {
          keptListingIds.push(l.id);
          continue;
        }
        await latest.current.deleteListing(l.id, { keepSelection: true });
        deletedListingIds.push(l.id);
      }

      return {
        deletedAnnotationIds: annotationIds,
        deletedTemplateIds,
        keptTemplateIds,
        deletedListingIds,
        keptListingIds,
      };
    },
    [dispatch, deleteAnnotations]
  );

  const applyLiveJob = useCallback(
    async (job) => {
      const jobId = job?.jobId;
      if (!jobId || attemptedRef.current.has(jobId)) return;
      // Only a visible tab draws (a hidden one would draw off-screen and
      // steal the job from the tab the user is looking at).
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;
      if (!latest.current.projectId) return;
      attemptedRef.current.add(jobId);

      // Claim first: the loser (another tab) or an expired job stops here.
      let claimed;
      try {
        claimed = await claimJob(jobId);
        dispatch(upsertAssistantRelayJobs([claimed]));
      } catch (e) {
        console.log("[assistantRelay] live claim skipped", jobId, e?.code);
        return;
      }

      try {
        const full = await fetchJob(jobId);
        if (!full?.payload) throw liveError("INVALID_PAYLOAD");
        const result =
          full.mode === "live_undo"
            ? await applyUndo(full)
            : await applyDraw(full);
        const acked = await ackJob(jobId, { status: "imported", result });
        dispatch(upsertAssistantRelayJobs([acked]));
        const message =
          full.mode === "live_undo"
            ? `ChatGPT : ${result.deletedAnnotationIds.length} annotation(s) annulée(s).${result.deletedListingIds.length ? " Liste supprimée." : ""}`
            : result.createdListingId
              ? `ChatGPT : liste « ${result.listingName} » créée (${result.templateIds.length} template(s)).`
              : result.armed
                ? "ChatGPT : cliquez sur le plan pour placer le dessin."
                : `ChatGPT : ${result.annotationIds.length} annotation(s), ${result.templateIds.length} template(s).`;
        dispatch(setToaster({ message, severity: "success" }));
      } catch (e) {
        console.log("[assistantRelay] live job failed", jobId, e);
        const message = e?.code
          ? describeRelayError(e)
          : (e?.message ?? "Commande impossible.");
        try {
          const failed = await ackJob(jobId, {
            status: "failed",
            error: String(e?.code ?? message).slice(0, 2000),
          });
          dispatch(upsertAssistantRelayJobs([failed]));
        } catch (ackError) {
          console.log("[assistantRelay] live ack failed", ackError);
        }
        dispatch(
          setToaster({
            message: `ChatGPT : ${message}`,
            isError: true,
            severity: "error",
          })
        );
      }
    },
    [dispatch, applyDraw, applyUndo]
  );

  return { applyLiveJob };
}
