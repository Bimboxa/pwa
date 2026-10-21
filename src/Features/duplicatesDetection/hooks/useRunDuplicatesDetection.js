import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  failDetection,
  finishDetection,
  startDetection,
} from "../duplicatesDetectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import runDuplicatesDetection from "../services/duplicatesDetectionService";
import getDuplicateCandidates from "../utils/getDuplicateCandidates";
import serializeAnnotationsForDetection from "../utils/serializeAnnotationsForDetection";
import {
  MIN_OVERLAP_M,
  MIN_OVERLAP_PX,
  MIN_THRESHOLD_PX,
  TOLERANCE_PX_FALLBACK,
} from "../constants/duplicatesDetectionConstants";

function newRunId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// run(annotations, { meterByPx, baseMapId }) → Promise<result | null>.
// Shared by the toolbar button (ctx.annotations) and the helper's
// « Relancer » (its own main-base-map query): the candidates filter makes both
// sets identical. Status / result go to duplicatesDetectionSlice.
export default function useRunDuplicatesDetection() {
  const dispatch = useDispatch();
  const toleranceCm = useSelector((s) => s.duplicatesDetection.toleranceCm);

  return useCallback(
    async (annotations, { meterByPx, baseMapId } = {}) => {
      const candidates = getDuplicateCandidates(annotations, { baseMapId });
      if (candidates.length < 2) {
        dispatch(
          setToaster({
            message: "Aucune annotation à comparer",
            isError: true,
          })
        );
        return null;
      }

      const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
      const thresholdPx = Math.max(
        MIN_THRESHOLD_PX,
        hasScale ? toleranceCm / 100 / meterByPx : TOLERANCE_PX_FALLBACK
      );
      // corner slivers never count: at least twice the tolerance
      const minOverlapPx = Math.max(
        2 * thresholdPx,
        hasScale ? MIN_OVERLAP_M / meterByPx : MIN_OVERLAP_PX
      );
      const runId = newRunId();

      dispatch(
        startDetection({
          runId,
          baseMapId: baseMapId ?? null,
          thresholdPx,
          meterByPx: hasScale ? meterByPx : null,
          hasScale,
          startedAt: Date.now(),
        })
      );

      try {
        const { promise } = runDuplicatesDetection({
          runId,
          annotations: serializeAnnotationsForDetection(candidates),
          options: { thresholdPx, minOverlapPx },
        });
        const result = await promise;
        dispatch(finishDetection({ runId, result, finishedAt: Date.now() }));
        return result;
      } catch (error) {
        if (error?.cancelled) return null;
        console.error("[duplicatesDetection] run failed:", error);
        dispatch(
          failDetection({
            runId,
            error: error?.message || "Duplicates detection failed",
          })
        );
        dispatch(
          setToaster({
            message: "Échec de la détection des doublons",
            isError: true,
          })
        );
        return null;
      }
    },
    [dispatch, toleranceCm]
  );
}
