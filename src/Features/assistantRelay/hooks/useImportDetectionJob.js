import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayJobActionStatus,
  upsertAssistantRelayJobs,
} from "../assistantRelaySlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";
import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";

import {
  ackJob,
  describeRelayError,
  fetchJob,
} from "../services/assistantRelayClient";

// Import a proposal (detected by ChatGPT) onto the main baseMap through the
// same pipeline as the "Import annotations" panel, then acknowledge it on
// the relay. Reject = ack only.
export default function useImportDetectionJob() {
  const dispatch = useDispatch();
  const mainBaseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const importJob = useCallback(
    async (jobId, { listingId }) => {
      dispatch(
        setAssistantRelayJobActionStatus({ jobId, status: "importing" })
      );
      let acked = null;
      try {
        const job = await fetchJob(jobId);
        if (!job?.payload) throw new Error("Proposition sans contenu.");

        // Same validator as the panel: the payload must be the inline shape.
        const parsed = parseImportAnnotationsJson(JSON.stringify(job.payload));
        if (!parsed.ok) throw new Error(parsed.error ?? "JSON invalide.");

        const result = await importAnnotationsInlineJsonService({
          data: parsed.data,
          projectId,
          listingId,
          mainBaseMap,
          widthMeters: parsed.data?.image?.widthMeters ?? null,
          relativeToBaseMap: true,
          dispatch,
        });

        acked = await ackJob(jobId, { status: "imported" });
        dispatch(upsertAssistantRelayJobs([acked]));
        dispatch(setAssistantRelayJobActionStatus({ jobId, status: null }));
        return { ok: true, count: result.placed.length };
      } catch (e) {
        console.log("[assistantRelay] import failed", e);
        const message = e?.code ? describeRelayError(e) : e?.message;
        // Report the failure to the relay so the model / user can see it;
        // never mask the original error if the ack itself fails.
        if (!acked && e?.code !== "JOB_ALREADY_RESOLVED") {
          try {
            const failed = await ackJob(jobId, {
              status: "failed",
              error: String(message ?? "import failed").slice(0, 2000),
            });
            dispatch(upsertAssistantRelayJobs([failed]));
          } catch (ackError) {
            console.log("[assistantRelay] ack failed", ackError);
          }
        }
        dispatch(setAssistantRelayJobActionStatus({ jobId, status: "error" }));
        return { ok: false, error: message };
      }
    },
    [dispatch, mainBaseMap, projectId]
  );

  const rejectJob = useCallback(
    async (jobId) => {
      dispatch(
        setAssistantRelayJobActionStatus({ jobId, status: "rejecting" })
      );
      try {
        const job = await ackJob(jobId, { status: "rejected" });
        dispatch(upsertAssistantRelayJobs([job]));
        dispatch(setAssistantRelayJobActionStatus({ jobId, status: null }));
        return { ok: true };
      } catch (e) {
        console.log("[assistantRelay] reject failed", e);
        dispatch(setAssistantRelayJobActionStatus({ jobId, status: "error" }));
        return { ok: false, error: describeRelayError(e) };
      }
    },
    [dispatch]
  );

  return {
    importJob,
    rejectJob,
    canImport: Boolean(mainBaseMap?.id && projectId),
  };
}
