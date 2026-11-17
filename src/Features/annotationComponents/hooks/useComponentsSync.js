import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import applyComponentService from "../services/applyComponentService";
import deleteComponentChildrenService from "../services/deleteComponentChildrenService";
import getComponentItems from "../utils/getComponentItems";
import getComponentSignature, {
  getPointRefsKey,
} from "../utils/getComponentSignature";
import isComponentTemplate from "../utils/isComponentTemplate";

// Changes of the sources coalesce this long (a burst of edits = one pass).
const DEBOUNCE_MS = 200;

const isLive = (row) => Boolean(row) && !row.deletedAt;
const EMPTY = { sources: [], childCounts: {} };

/**
 * Keeps the children of the components (see constants/componentConstants.js,
 * applyComponentService) in sync with their source annotation, project-wide:
 *
 *   - source drawn / pasted / imported: its children are GENERATED;
 *   - source topology edited (vertex added / removed, closure, band side),
 *     items toggled, item templates edited: the children are RECONCILED in
 *     place. Moving a vertex needs nothing — the points are shared;
 *   - a child is missing / in excess, or its point refs drifted from the
 *     source: same;
 *   - source deleted or no longer a component: the children are DELETED.
 *
 * A source = an annotation whose template is a COMPONENT template — whatever
 * path created it (2D / 3D drawing, paste, import).
 *
 * Same design as useSystemsSync: a watcher rather than a call at every commit
 * site, writes without undo entry (undoing the source change re-derives the
 * rows), the deletion of a source also cascading in useDeleteAnnotations
 * (same undo group). Skipped in read-only scopes; a source whose regeneration
 * fails is left alone until it changes again.
 */
export default function useComponentsSync() {
  // data

  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { isReadOnly } = useReadOnlyScope();

  // Sources of the project with their current signature, and the count of
  // children of every referenced source — live or not.
  const state = useLiveQuery(async () => {
    if (!projectId) return EMPTY;
    const templates = (
      await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .toArray()
    ).filter(isLive);
    const templateById = new Map(templates.map((t) => [t.id, t]));
    const componentTemplateIds = new Set(
      templates.filter(isComponentTemplate).map((t) => t.id)
    );

    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .toArray();
    const childrenBySourceId = new Map();
    for (const a of rows) {
      if (!isLive(a) || !a.componentSourceAnnotationId) continue;
      if (!childrenBySourceId.has(a.componentSourceAnnotationId))
        childrenBySourceId.set(a.componentSourceAnnotationId, []);
      childrenBySourceId.get(a.componentSourceAnnotationId).push(a);
    }
    const childCounts = {};
    for (const [sourceId, children] of childrenBySourceId)
      childCounts[sourceId] = children.length;
    if (!componentTemplateIds.size) return { sources: [], childCounts };

    const sources = rows
      .filter(
        (a) =>
          isLive(a) &&
          !a.componentSourceAnnotationId &&
          componentTemplateIds.has(a.annotationTemplateId)
      )
      .map((source) => {
        const refsKey = getPointRefsKey(source.points);
        const children = childrenBySourceId.get(source.id) ?? [];
        return {
          id: source.id,
          appliedSignature: source.componentApplied?.signature ?? null,
          appliedCount: source.componentApplied?.count ?? null,
          // a child whose point refs are no longer those of the source
          drifted: children.some((c) => getPointRefsKey(c.points) !== refsKey),
          signature: getComponentSignature({
            source,
            items: getComponentItems(
              templateById.get(source.annotationTemplateId),
              templateById,
              source.componentItemsEnabled
            ),
          }),
        };
      });
    return { sources, childCounts };
  }, [projectId]);

  // state

  const dataRef = useRef({ state: null, projectId: null });
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const disposedRef = useRef(false);
  // sourceId → state already attempted WITHOUT success: never retried until
  // the source changes again.
  const failedRef = useRef(new Map());

  // helpers

  async function syncOnce() {
    const { state: current, projectId: pid } = dataRef.current;
    if (!current) return;
    const failed = failedRef.current;
    const sourceIds = new Set(current.sources.map((s) => s.id));

    // children whose source is gone / no longer a component
    const orphanSourceIds = Object.keys(current.childCounts).filter(
      (id) => !sourceIds.has(id) && failed.get(id) !== "deleted"
    );
    if (orphanSourceIds.length) {
      orphanSourceIds.forEach((id) => failed.set(id, "deleted"));
      try {
        const deleted = await deleteComponentChildrenService({
          sourceIds: orphanSourceIds,
          projectId: pid,
        });
        orphanSourceIds.forEach((id) => failed.delete(id));
        if (deleted) dispatch(triggerAnnotationsUpdate());
      } catch (error) {
        console.warn("[componentsSync] removal skipped", error);
      }
    }

    for (const source of current.sources) {
      if (disposedRef.current) return;
      if (source.signature == null) continue;
      const count = current.childCounts[source.id] ?? 0;
      if (
        !source.drifted &&
        source.appliedSignature === source.signature &&
        source.appliedCount === count
      )
        continue;
      const attempt = `${source.signature}#${count}#${source.drifted ? 1 : 0}`;
      if (failed.get(source.id) === attempt) continue;
      failed.set(source.id, attempt);
      try {
        await applyComponentService({ sourceId: source.id, dispatch });
        failed.delete(source.id);
      } catch (error) {
        console.warn("[componentsSync] regeneration skipped", source.id, error);
      }
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
    dataRef.current = { state: state ?? null, projectId };
  }, [state, projectId]);

  // Scope switch: the ownership / read-only context changed — forget the
  // failures so the sources get another chance.
  useEffect(() => {
    failedRef.current.clear();
  }, [scopeId]);

  useEffect(() => {
    if (isReadOnly || !scopeId || !state) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    return undefined;
  }, [state, isReadOnly, scopeId]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);
}
