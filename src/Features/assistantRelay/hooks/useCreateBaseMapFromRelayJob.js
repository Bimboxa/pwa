import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayBaseMapJobActionStatus,
  setAssistantRelayPublishStatus,
  setAssistantRelaySnapshot,
  upsertAssistantRelayBaseMapJobs,
} from "../assistantRelaySlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import db from "App/db/db";
import BaseMap from "Features/baseMaps/js/BaseMap";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useTriggerInitialScopeSaveIfNeeded from "Features/remoteScopeConfigurations/hooks/useTriggerInitialScopeSaveIfNeeded";
import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import useAssistantRelayConfig from "./useAssistantRelayConfig";
import publishBaseMapSnapshotService from "../services/publishBaseMapSnapshotService";
import renderBaseMapJobImage from "../services/renderBaseMapJobImage";
import {
  ackBaseMapJob,
  describeRelayError,
  fetchBaseMapJob,
  fetchBaseMapJobPdf,
} from "../services/assistantRelayClient";

// Turns a base map job proposed from the ChatGPT component into a local
// base map: download the PDF from the relay, rasterize it with the native
// PDF pipeline, create the base map in the chosen BASE_MAP listing, ack the
// job, then republish the base map so the model can analyse it.
//
// Retry-safe: a base map already created for this job (createdFrom.relay
// .baseMapJobId) is reused instead of creating a second one, and the relay
// accepts a repeated `imported` ack with the same baseMapId.
export default function useCreateBaseMapFromRelayJob() {
  const dispatch = useDispatch();
  const config = useAssistantRelayConfig();
  const createBaseMaps = useCreateBaseMaps();
  const triggerInitialSaveIfNeeded = useTriggerInitialScopeSaveIfNeeded();
  const logAppEvent = useLogAppEvent();
  const templates = useAnnotationTemplates();

  const mainBaseMap = useMainBaseMap();
  const listings = useProjectBaseMapListings();
  const selectedBaseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsListingId = useSelector((s) => s.listings.selectedListingId);

  // Default target: listing of the current base map → selected base maps
  // listing → first project listing → undefined (useCreateBaseMaps creates
  // the default listing).
  const defaultListingId =
    (mainBaseMap?.listingId &&
    listings?.some((l) => l.id === mainBaseMap.listingId)
      ? mainBaseMap.listingId
      : selectedBaseMapsListingId &&
          listings?.some((l) => l.id === selectedBaseMapsListingId)
        ? selectedBaseMapsListingId
        : listings?.[0]?.id) ?? "";

  const setStatus = useCallback(
    (jobId, status) =>
      dispatch(setAssistantRelayBaseMapJobActionStatus({ jobId, status })),
    [dispatch]
  );

  const findExistingBaseMap = useCallback(
    async (jobId) => {
      if (!projectId) return null;
      const rows = await db.baseMaps
        .where("projectId")
        .equals(projectId)
        .toArray();
      return (
        rows.find(
          (b) => !b.deletedAt && b.createdFrom?.relay?.baseMapJobId === jobId
        ) ?? null
      );
    },
    [projectId]
  );

  const publishRecord = useCallback(
    async (record) => {
      dispatch(
        setAssistantRelayPublishStatus({ status: "publishing", message: null })
      );
      try {
        const snapshot = await publishBaseMapSnapshotService({
          baseMap: new BaseMap(record),
          projectId,
          scopeId,
          listingId: annotationsListingId,
          templates,
          config,
        });
        dispatch(setAssistantRelaySnapshot(snapshot));
        dispatch(
          setAssistantRelayPublishStatus({
            status: "success",
            message: `Fond publié (${snapshot?.image?.width}×${snapshot?.image?.height}).`,
          })
        );
        return { ok: true, snapshot };
      } catch (e) {
        console.log("[assistantRelay] publish after import failed", e);
        const message = e?.code ? describeRelayError(e) : e?.message;
        dispatch(setAssistantRelayPublishStatus({ status: "error", message }));
        return { ok: false, error: message };
      }
    },
    [dispatch, projectId, scopeId, annotationsListingId, templates, config]
  );

  const createFromJob = useCallback(
    async (jobId, { listingId } = {}) => {
      if (!projectId) return { ok: false, error: "Aucun projet sélectionné." };
      let created = false;
      try {
        setStatus(jobId, "downloading");
        const job = await fetchBaseMapJob(jobId);
        if (!job?.frame)
          throw new Error("Proposition incomplète (cadre manquant).");

        // Retry after a lost ack: never create the base map twice.
        let record = await findExistingBaseMap(jobId);
        if (!record) {
          const pdfBlob = await fetchBaseMapJobPdf(job);

          setStatus(jobId, "rendering");
          const rendered = await renderBaseMapJobImage({
            pdfBlob,
            pdfFileName: job.pdfFileName ?? job.pdf?.fileName,
            frame: job.frame,
            relay: {
              workspace: job.workspace ?? config?.workspace ?? "main",
              baseMapJobId: job.jobId,
              sourcePdfId: job.sourcePdfId,
              relayBaseUrl: config?.relayBaseUrl ?? null,
            },
          });

          setStatus(jobId, "creating");
          const listing = listings?.find((l) => l.id === listingId);
          const records = await createBaseMaps(
            [
              {
                name: job.name,
                imageFile: rendered.imageFile,
                meterByPx: rendered.meterByPx,
                createdFrom: rendered.createdFrom,
              },
            ],
            listing ? { listing } : undefined
          );
          record = records?.[0];
          if (!record?.id)
            throw new Error("Création du fond de plan impossible.");
          created = true;
          logAppEvent("BASE_MAP_CREATED", {
            name: job.name,
            source: "assistantRelay",
            pageNumber: job.frame.pageNumber,
            dpi: rendered.dpi,
          });
          triggerInitialSaveIfNeeded();
        }
        dispatch(setSelectedMainBaseMapId(record.id));

        const acked = await ackBaseMapJob(jobId, {
          status: "imported",
          baseMapId: record.id,
        });
        dispatch(upsertAssistantRelayBaseMapJobs([acked]));

        let publish = null;
        if (config?.autoPublishAfterImport !== false) {
          setStatus(jobId, "publishing");
          publish = await publishRecord(record);
        }
        setStatus(jobId, null);
        return {
          ok: true,
          baseMapId: record.id,
          reused: !created && !!record,
          publishError: publish && !publish.ok ? publish.error : null,
        };
      } catch (e) {
        console.log("[assistantRelay] base map import failed", e);
        const message = e?.code ? describeRelayError(e) : e?.message;
        // A base map that was created must not be reported as failed: the
        // user can retry the ack (the record is found again).
        if (!created && e?.code !== "JOB_ALREADY_RESOLVED") {
          try {
            const failed = await ackBaseMapJob(jobId, {
              status: "failed",
              error: String(message ?? "import failed").slice(0, 2000),
            });
            dispatch(upsertAssistantRelayBaseMapJobs([failed]));
          } catch (ackError) {
            console.log("[assistantRelay] base map ack failed", ackError);
          }
        }
        setStatus(jobId, "error");
        return { ok: false, error: message, created };
      }
    },
    [
      projectId,
      config,
      listings,
      createBaseMaps,
      findExistingBaseMap,
      publishRecord,
      logAppEvent,
      triggerInitialSaveIfNeeded,
      dispatch,
      setStatus,
    ]
  );

  const rejectBaseMapJob = useCallback(
    async (jobId) => {
      setStatus(jobId, "rejecting");
      try {
        const job = await ackBaseMapJob(jobId, { status: "rejected" });
        dispatch(upsertAssistantRelayBaseMapJobs([job]));
        setStatus(jobId, null);
        return { ok: true };
      } catch (e) {
        console.log("[assistantRelay] base map reject failed", e);
        setStatus(jobId, "error");
        return { ok: false, error: describeRelayError(e) };
      }
    },
    [dispatch, setStatus]
  );

  return {
    createFromJob,
    rejectBaseMapJob,
    listings: listings ?? [],
    defaultListingId,
    canImport: Boolean(projectId),
  };
}
