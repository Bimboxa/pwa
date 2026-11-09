import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import applyProfileFromAnnotationService from "../services/applyProfileFromAnnotationService";
import deleteProfileLinesService from "../services/deleteProfileLinesService";
import getProfileSourceSignature from "../utils/getProfileSourceSignature";

// Changes of the sources coalesce this long (a vertex drag = one pass).
const DEBOUNCE_MS = 400;

const isLive = (row) => Boolean(row) && !row.deletedAt;
const lineKey = (annotationId, index) => `${annotationId}:${index}`;

/**
 * Keeps the profile lines generated from a source drawing (« Choisir un
 * profil » — applyProfileFromAnnotationService, `line.sourceAnnotationId`)
 * in sync with that drawing, project-wide:
 *
 *   - source edited (vertices, arc / base point flags, hidden segments,
 *     closure, base map scale): the line is RE-APPLIED in place, same guide
 *     segment (`line.seedSegmentIndex`, inferred for legacy lines), same
 *     « Inverser » / « Miroir » options — the 3D sweep and the quantities
 *     follow through the usual live queries;
 *   - source deleted: the line is REMOVED from the target (its points too),
 *     the target becomes a plain polyline again.
 *
 * Change detection: `line.sourceSignature` (the source as read when the line
 * was applied — getProfileSourceSignature) vs the source's current
 * signature. Lines written before the signature existed adopt the current
 * one silently (derived write: no stamp, no undo) instead of being rebuilt.
 *
 * Writes are real, audited edits of the target (they sync like any user
 * edit) but push NO undo entry (tx.skipUndo): undoing the source change
 * re-derives the line. Consequence: undoing the DELETION of a source does not
 * bring its dependent lines back — re-apply them with « Choisir un profil ».
 *
 * Skipped in read-only scopes; a target that refuses the write (ownership,
 * linked listing…) is left alone until its source changes again.
 */
export default function useProfileLinesSourceSync() {
  // data

  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { isReadOnly } = useReadOnlyScope();

  // Targets of the project: annotations carrying a sourced profile line.
  // Re-runs on annotation writes of the project only (the points of the
  // sources are observed by the second query).
  const targets = useLiveQuery(async () => {
    if (!projectId) return [];
    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .toArray();
    const out = [];
    for (const a of rows) {
      if (!isLive(a) || !Array.isArray(a.profileLines)) continue;
      const lines = [];
      a.profileLines.forEach((l, index) => {
        if (!l?.sourceAnnotationId) return;
        lines.push({
          index,
          sourceAnnotationId: l.sourceAnnotationId,
          sourceSignature: l.sourceSignature ?? null,
          seedSegmentIndex: Number.isInteger(l.seedSegmentIndex)
            ? l.seedSegmentIndex
            : null,
          invert: Boolean(l.sourceInvert),
          mirror: Boolean(l.mirror),
        });
      });
      if (lines.length) out.push({ id: a.id, lines });
    }
    return out;
  }, [projectId]);

  const sourceIdsKey = [
    ...new Set(
      (targets ?? []).flatMap((t) => t.lines.map((l) => l.sourceAnnotationId))
    ),
  ]
    .sort()
    .join(",");

  // Current signature of every referenced source (null = gone).
  const signatures = useLiveQuery(async () => {
    const ids = sourceIdsKey ? sourceIdsKey.split(",") : [];
    if (!ids.length) return {};
    const sources = await db.annotations.bulkGet(ids);
    const pointIds = sources.flatMap((s) =>
      isLive(s) ? (s.points ?? []).map((p) => p?.id).filter(Boolean) : []
    );
    const baseMapIds = [
      ...new Set(
        sources
          .filter(isLive)
          .map((s) => s.baseMapId)
          .filter(Boolean)
      ),
    ];
    const [pointRows, baseMaps] = await Promise.all([
      pointIds.length ? db.points.bulkGet(pointIds) : [],
      baseMapIds.length ? db.baseMaps.bulkGet(baseMapIds) : [],
    ]);
    const pointById = new Map(pointRows.filter(Boolean).map((p) => [p.id, p]));
    const baseMapById = new Map(baseMaps.filter(Boolean).map((b) => [b.id, b]));
    const out = {};
    ids.forEach((id, i) => {
      const src = sources[i];
      out[id] = isLive(src)
        ? getProfileSourceSignature({
            src,
            srcRows: (src.points ?? []).map((p) => pointById.get(p?.id)),
            srcBaseMap: baseMapById.get(src.baseMapId),
          })
        : null;
    });
    return out;
  }, [sourceIdsKey]);

  // state

  const dataRef = useRef({ targets: [], signatures: null });
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const disposedRef = useRef(false);
  // lineKey → source signature already attempted (success or refusal): never
  // retried until the source changes again.
  const attemptedRef = useRef(new Map());

  // helpers

  async function syncOnce() {
    const { targets: list, signatures: sigs } = dataRef.current;
    if (!sigs || !list?.length) return;
    const attempted = attemptedRef.current;
    for (const target of list) {
      if (disposedRef.current) return;
      const toRemove = [];
      for (const line of target.lines) {
        if (!(line.sourceAnnotationId in sigs)) continue;
        const current = sigs[line.sourceAnnotationId];
        const key = lineKey(target.id, line.index);
        if (current == null) {
          // source gone
          if (attempted.get(key) === "deleted") continue;
          attempted.set(key, "deleted");
          toRemove.push(line.index);
          continue;
        }
        if (line.sourceSignature === current) continue;
        if (attempted.get(key) === current) continue;
        attempted.set(key, current);
        if (line.sourceSignature == null) {
          // legacy line: adopt the current source as its reference
          await adoptSignature(target.id, line.index, current);
          continue;
        }
        try {
          await applyProfileFromAnnotationService({
            annotationId: target.id,
            sourceAnnotationId: line.sourceAnnotationId,
            profileIndex: line.index,
            seedSegmentIndex: line.seedSegmentIndex,
            invert: line.invert,
            mirror: line.mirror,
            skipUndo: true,
            dispatch,
          });
        } catch (error) {
          console.warn("[profileLinesSourceSync] re-apply skipped", key, error);
        }
      }
      if (toRemove.length) {
        try {
          await deleteProfileLinesService({
            annotationId: target.id,
            indices: toRemove,
            skipUndo: true,
          });
        } catch (error) {
          console.warn(
            "[profileLinesSourceSync] removal skipped",
            target.id,
            error
          );
        }
      }
    }
  }

  async function adoptSignature(annotationId, index, signature) {
    try {
      await db.transaction("rw", db.annotations, async (tx) => {
        tx.derivedWrite = true;
        const ann = await db.annotations.get(annotationId);
        const line = ann?.profileLines?.[index];
        if (!line || line.sourceSignature) return;
        const profileLines = ann.profileLines.map((l, i) =>
          i === index ? { ...l, sourceSignature: signature } : l
        );
        await db.annotations.update(annotationId, { profileLines });
      });
    } catch (error) {
      console.warn(
        "[profileLinesSourceSync] adopt skipped",
        annotationId,
        error
      );
    }
  }

  async function flush() {
    timerRef.current = null;
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      do {
        rerunRef.current = false;
        await syncOnce();
      } while (rerunRef.current && !disposedRef.current);
    } finally {
      runningRef.current = false;
    }
  }

  // effects

  useEffect(() => {
    dataRef.current = {
      targets: targets ?? [],
      signatures: signatures ?? null,
    };
  }, [targets, signatures]);

  // Scope switch: the ownership / read-only context changed — forget the
  // refusals so the lines get another chance.
  useEffect(() => {
    attemptedRef.current.clear();
  }, [scopeId]);

  useEffect(() => {
    if (isReadOnly || !scopeId || !targets || !signatures) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    return undefined;
  }, [targets, signatures, isReadOnly, scopeId]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);
}
