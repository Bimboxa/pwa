import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayJobActionStatus,
  upsertAssistantRelayJobs,
} from "../assistantRelaySlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import db from "App/db/db";
import BaseMap from "Features/baseMaps/js/BaseMap";
import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";
import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";

import {
  ackJob,
  describeRelayError,
  fetchJob,
} from "../services/assistantRelayClient";

// Loads the base map a proposal was detected on. The relay returns, with the
// job, the snapshot it targets (`snapshot.baseMapId`): the import goes onto
// THAT base map, never onto the current one, even if another base map was
// published in between.
async function loadTargetBaseMap(job, projectId) {
  const baseMapId = job?.snapshot?.baseMapId;
  if (!baseMapId) {
    throw new Error("Proposition sans fond de plan cible (snapshot manquant).");
  }
  const record = await db.baseMaps.get(baseMapId);
  if (!record || record.deletedAt) {
    throw new Error(
      `Fond de plan introuvable localement (« ${
        job.snapshot?.name ?? baseMapId
      } »). Ouvrez le projet qui le contient ou republiez-le.`
    );
  }
  if (record.projectId && projectId && record.projectId !== projectId) {
    throw new Error(
      `Ce fond de plan appartient à un autre projet (« ${
        record.name ?? baseMapId
      } »). Ouvrez ce projet pour importer la proposition.`
    );
  }
  const versions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
  ).filter((v) => !v.deletedAt);
  return BaseMap.createFromRecord(record, versions);
}

// Import a proposal (detected by ChatGPT) onto the base map it targets,
// through the same pipeline as the "Import annotations" panel, then
// acknowledge it on the relay. Reject = ack only.
export default function useImportDetectionJob() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const importJob = useCallback(
    async (jobId, { listingId }) => {
      dispatch(
        setAssistantRelayJobActionStatus({ jobId, status: "importing" })
      );
      let acked = null;
      try {
        const job = await fetchJob(jobId);
        if (!job?.payload) throw new Error("Proposition sans contenu.");

        const targetBaseMap = await loadTargetBaseMap(job, projectId);

        // Same validator as the panel: the payload must be the inline shape.
        const parsed = parseImportAnnotationsJson(JSON.stringify(job.payload));
        if (!parsed.ok) throw new Error(parsed.error ?? "JSON invalide.");

        const result = await importAnnotationsInlineJsonService({
          data: parsed.data,
          projectId,
          listingId,
          mainBaseMap: targetBaseMap,
          widthMeters: parsed.data?.image?.widthMeters ?? null,
          relativeToBaseMap: true,
          dispatch,
        });

        // Show the user where the annotations landed.
        if (targetBaseMap.id !== selectedBaseMapId) {
          dispatch(setSelectedMainBaseMapId(targetBaseMap.id));
        }

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
    [dispatch, projectId, selectedBaseMapId]
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
    canImport: Boolean(projectId),
  };
}
