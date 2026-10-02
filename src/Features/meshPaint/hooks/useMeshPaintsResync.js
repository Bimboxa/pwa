import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";

import useMeshPaints from "Features/meshPaint/hooks/useMeshPaints";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import { getHostPartData } from "Features/meshPaint/js/buildHostPartIndexFromObject";
import applyMeshPaintsResyncService, {
  touchMeshPaintsSyncedAt,
} from "Features/meshPaint/services/applyMeshPaintsResyncService";
import { isShrinkableAnnotation } from "Features/meshPaint/services/ensureUnshrunkHostObject";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import planPaintResync from "Features/meshPaint/utils/planPaintResync";
import {
  getMeshPaintHostTime,
  isMeshPaintStale,
} from "Features/meshPaint/utils/resolveMeshPaints";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Hosts are re-synced this long after their last change notification (a
// drag / a burst of rebuilds coalesces into one pass).
const DEBOUNCE_MS = 300;
const IDLE_TIMEOUT_MS = 500;

const isLive = (row) => Boolean(row) && !row.deletedAt;

function waitIdle() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      window.requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
    } else {
      setTimeout(resolve, 16);
    }
  });
}

/**
 * Re-sync of the painted parts (« Pinceau ») on the 3D objects of their
 * hosts: a paint is a 3D snapshot glued back on its host after every change
 * (planPaintResync: same / parallel facet or edge; lost → ORPHAN).
 *
 * - Triggers: AnnotationsManager "ready" notifications of painted hosts
 *   (the rebuild of a changed host), annotationsLoadTick, and any change of
 *   the paint rows; debounced, then processed host by host in idle slices.
 * - Skipped: read-only scopes; hosts not built in 3D (hidden: the paint
 *   stays frozen, flagged « à vérifier » at read time), not in their base
 *   map frame, still awaiting their CSG carve (the carved object is notified
 *   again), or still displayed shrunk (their un-shrunk rebuild — the
 *   exemption of painted hosts — is on its way).
 * - Change detection: the hash of the displayed host geometry
 *   (getHostPartData) vs the rows' sync.geomHash. Unchanged → nothing is
 *   planned; stale rows (host row edited after the last sync without a
 *   geometric change) only get their syncedAt refreshed, once per host
 *   version.
 * - Only the rows of the selected scope are re-synced. Writes are derived
 *   writes (applyMeshPaintsResyncService): no audit stamp, no undo entry.
 */
export default function useMeshPaintsResync() {
  // data

  const { rows, hostById, loaded } = useMeshPaints();
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  const { isReadOnly } = useReadOnlyScope();

  // state

  const dataRef = useRef({ rows: [], hostById: {}, scopeId: null });
  const dirtyRef = useRef(new Set());
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const disposedRef = useRef(false);
  // rowId → host geometry time (getMeshPaintHostTime) its syncedAt was
  // refreshed for (never twice: a host clock ahead of ours would loop
  // otherwise).
  const touchedRef = useRef(new Map());
  const scheduleRef = useRef(() => {});

  // helpers

  function getPaintedHostIds() {
    const { rows: allRows, scopeId: currentScopeId } = dataRef.current;
    const ids = new Set();
    for (const row of allRows) {
      if (!isLive(row)) continue;
      if ((row.scopeId ?? null) !== (currentScopeId ?? null)) continue;
      ids.add(row.hostAnnotationId);
    }
    return ids;
  }

  async function resyncHost(hostId) {
    const {
      rows: allRows,
      hostById: hosts,
      scopeId: currentScopeId,
      isReadOnly: readOnly,
      antiAliasingShrink: shrinkOn,
    } = dataRef.current;
    if (readOnly) return;

    const sceneManager = getActiveThreedEditor()?.sceneManager;
    const annotationsManager = sceneManager?.annotationsManager;
    const imagesManager = sceneManager?.imagesManager;
    if (!annotationsManager || !imagesManager) return;

    const root = annotationsManager.annotationsObjectsMap?.[hostId];
    if (!root) return; // not built: frozen until displayed again
    if (annotationsManager.isCarvePending?.(hostId)) return;
    const host = hosts[hostId];
    if (!isLive(host)) return;

    const source = annotationsManager.getAnnotationSource?.(hostId) ?? null;
    // Still shrunk: its exempt rebuild is on its way (never sync on it).
    if (
      shrinkOn &&
      isShrinkableAnnotation(source) &&
      !source._noAntiAliasingShrink
    ) {
      return;
    }

    const baseMapId = root.userData?.baseMapId ?? host.baseMapId;
    const group = imagesManager.getGroup?.(baseMapId);
    if (!group || root.parent !== group) return;
    const baseMap = imagesManager.baseMapsMap?.[baseMapId];
    const metrics = getMeshPaintMetrics(baseMap);
    if (!metrics) return;

    const hostRows = allRows.filter(
      (row) =>
        isLive(row) &&
        row.hostAnnotationId === hostId &&
        (row.scopeId ?? null) === (currentScopeId ?? null)
    );
    if (!hostRows.length) return;

    const data = getHostPartData({ root, group, source, baseMap });
    if (!data) return;

    const needsPlan = hostRows.some(
      (row) =>
        row.sync?.provisional ||
        row.sync?.nearOnly ||
        (row.sync?.geomHash ?? null) !== data.hash
    );
    if (needsPlan) {
      const changes = planPaintResync({
        rows: hostRows,
        index: data.getIndex(),
        metrics,
      });
      await applyMeshPaintsResyncService({
        hostId,
        changes,
        geomHash: data.hash,
      });
      return;
    }

    // Geometry unchanged: clear the « à vérifier » flag of a host row edited
    // without a geometric change (name, template...).
    const touched = touchedRef.current;
    const hostTime = getMeshPaintHostTime(host);
    const stale = hostRows.filter(
      (row) => isMeshPaintStale(row, host) && touched.get(row.id) !== hostTime
    );
    if (!stale.length) return;
    stale.forEach((row) => touched.set(row.id, hostTime));
    await touchMeshPaintsSyncedAt({ ids: stale.map((row) => row.id) });
  }

  async function flush() {
    timerRef.current = null;
    if (runningRef.current) return; // the running loop drains the set
    runningRef.current = true;
    try {
      const dirty = dirtyRef.current;
      while (dirty.size && !disposedRef.current) {
        const hostId = dirty.values().next().value;
        dirty.delete(hostId);
        await waitIdle();
        if (disposedRef.current) break;
        try {
          await resyncHost(hostId);
        } catch (error) {
          console.warn("[meshPaintsResync] host skipped", hostId, error);
        }
      }
    } finally {
      runningRef.current = false;
    }
  }

  function schedule(hostIds) {
    if (disposedRef.current) return;
    let added = false;
    for (const id of hostIds) {
      if (!id) continue;
      dirtyRef.current.add(id);
      added = true;
    }
    if (!added) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }
  scheduleRef.current = schedule;

  // effects

  useEffect(() => {
    dataRef.current = {
      rows,
      hostById,
      scopeId,
      isReadOnly,
      antiAliasingShrink,
    };
  }, [rows, hostById, scopeId, isReadOnly, antiAliasingShrink]);

  // Rows changed (a paint, an undo, a scope switch), a scene (re)load, the
  // read-only state: check every painted host (unchanged hosts cost a
  // cached hash lookup).
  useEffect(() => {
    if (!loaded || isReadOnly) return;
    scheduleRef.current(getPaintedHostIds());
  }, [loaded, rows, scopeId, annotationsLoadTick, isReadOnly]);

  // Rebuilt painted hosts (2D edit, push / pull, cut, un-shrink, carve).
  useEffect(() => {
    disposedRef.current = false;
    const annotationsManager =
      getActiveThreedEditor()?.sceneManager?.annotationsManager;
    const unsubscribe = annotationsManager?.subscribeAnnotationReady?.(
      (ids) => {
        const painted = getPaintedHostIds();
        scheduleRef.current((ids || []).filter((id) => painted.has(id)));
      }
    );
    return () => {
      disposedRef.current = true;
      unsubscribe?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      dirtyRef.current.clear();
    };
  }, []);
}
