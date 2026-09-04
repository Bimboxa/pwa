import { useState } from "react";
import { useSelector } from "react-redux";

import { getDrawingCommitInterceptor } from "../services/drawingCommitInterceptors";

// ---------------------------------------------------------------------------
// useDeferredDrawingCommit — generic "commit on click → dialog → confirm →
// actual creation" mechanism. Wraps the editor's commit function: when the
// armed newAnnotation carries a commitInterceptor { key, context }, the
// matching registry entry (drawingCommitInterceptors) decides at commit time
// whether to proceed directly (with extra options) or to park the commit and
// open a dialog. The pending commit lives in LOCAL state on purpose: the
// payload needs no serialization, and unmounting the editor (module switch)
// drops it — cancel-by-navigation for free.
//
// After the actual write (direct or resumed), an entry's optional
// afterCommit({ result, newAnnotation, context, deps }) runs with the commit
// result ({ annotation, updatedAnnotation } from useHandleCommitDrawing) —
// post-creation side effects (links, one-shot disarm…) without touching the
// commit hook.
//
// commitFn: the untouched useHandleCommitDrawing().handleDrawingCommit.
// deps: { projectId, createdBy, dispatch, deleteAnnotations } forwarded to
// interceptors.
// ---------------------------------------------------------------------------

export default function useDeferredDrawingCommit({ commitFn, deps }) {
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // pending = { key, points, options, newAnnotation (stripped), context }
  const [pending, setPending] = useState(null);

  const commit = async (rawPoints, options) => {
    const key = newAnnotation?.commitInterceptor?.key;
    const entry = getDrawingCommitInterceptor(key);
    if (!entry) return commitFn(rawPoints, options);

    // The commitInterceptor field is transport-only: never let it reach the
    // annotation record (options.newAnnotation is the override channel read
    // by useHandleCommitDrawing).
    const { commitInterceptor, ...strippedNewAnnotation } = newAnnotation;
    const context = commitInterceptor.context;

    const result = await entry.intercept({
      points: rawPoints,
      options,
      newAnnotation: strippedNewAnnotation,
      context,
      deps,
    });

    if (result?.openDialog) {
      setPending({
        key,
        points: rawPoints,
        options,
        newAnnotation: strippedNewAnnotation,
        context,
      });
      return;
    }

    const commitResult = await commitFn(rawPoints, {
      ...options,
      newAnnotation: strippedNewAnnotation,
      ...(result?.proceed?.extraOptions ?? {}),
    });
    if (entry.afterCommit) {
      await entry.afterCommit({
        result: commitResult,
        newAnnotation: strippedNewAnnotation,
        context,
        deps,
      });
    }
    return commitResult;
  };

  const resumeCommit = async (extraOptions) => {
    if (!pending) return;
    const {
      key,
      points,
      options,
      newAnnotation: strippedNewAnnotation,
      context,
    } = pending;
    setPending(null);
    const commitResult = await commitFn(points, {
      ...options,
      newAnnotation: strippedNewAnnotation,
      ...(extraOptions ?? {}),
    });
    const entry = getDrawingCommitInterceptor(key);
    if (entry?.afterCommit) {
      await entry.afterCommit({
        result: commitResult,
        newAnnotation: strippedNewAnnotation,
        context,
        deps,
      });
    }
    return commitResult;
  };

  // Nothing was written before the dialog opened, and the InteractionLayer
  // already reset its local drawing points when commitPoint() returned: the
  // tool simply stays armed.
  const cancelCommit = () => setPending(null);

  return { commit, pending, resumeCommit, cancelCommit };
}
