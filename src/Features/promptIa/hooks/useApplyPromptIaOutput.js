import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import editor from "App/editor";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useDeleteBaseMap from "Features/baseMaps/hooks/useDeleteBaseMap";
import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";
import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";
import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import loadSourcePdf from "../services/loadSourcePdf";
import readPdfPageFrame from "../services/readPdfPageFrame";
import {
  extractJsonText,
  normalizePromptIaPayload,
} from "../utils/parsePromptIaOutput";
import { convertPayloadToImageSpace } from "../utils/pdfUserSpaceToImage";

// What the payload will create, for the preview shown before the import.
function buildPreview({ data, normalized, dropped }) {
  const templates = Array.isArray(data.annotationTemplates)
    ? data.annotationTemplates
    : [];
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  const reused = new Set(normalized.reusedTemplateIds);
  const countByTemplateId = new Map();
  for (const annotation of annotations) {
    const id = annotation?.annotationTemplateId ?? null;
    countByTemplateId.set(id, (countByTemplateId.get(id) ?? 0) + 1);
  }
  return {
    annotations: annotations.length,
    newTemplates: templates.filter((t) => !reused.has(t.id)).length,
    reusedTemplates: reused.size,
    newBaseMaps: Array.isArray(data.baseMaps) ? data.baseMaps.length : 0,
    reusedBaseMaps: normalized.reusedBaseMapIds.length,
    dropped: dropped.length,
    note: normalized.note,
    byTemplate: templates
      .map((t) => ({
        id: t.id,
        label: t.label ?? t.name ?? t.type,
        isNew: !reused.has(t.id),
        count: countByTemplateId.get(t.id) ?? 0,
      }))
      .filter((row) => row.count > 0 || row.isNew),
  };
}

/**
 * Reads the JSON given back by an external AI chat (Prompt IA zip), then
 * applies it to the current base map / listing, and undoes the last
 * application. Two phases, so the screen can show a preview in between:
 *
 * prepare(text) → { ok, prepared } | { ok: false, error } — nothing written
 * apply(prepared) → { ok, result } | { ok: false, error }
 */
export default function useApplyPromptIaOutput() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const mainBaseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const deleteAnnotations = useDeleteAnnotations();
  const deleteBaseMap = useDeleteBaseMap();
  const detailBaseMaps = useDetailBaseMaps();
  const { value: userEmail } = useUserEmail();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const busyRef = useRef(false);

  const prepare = useCallback(
    async (text) => {
      const extracted = extractJsonText(text);
      if (!extracted.ok) {
        setError(extracted.error);
        return { ok: false, error: extracted.error };
      }
      if (!projectId || !listingId || !mainBaseMap?.id) {
        const msg = "Sélectionnez un fond de plan et une liste avant de coller.";
        setError(msg);
        return { ok: false, error: msg };
      }
      setError(null);
      try {
        const existingTemplateIds = (templates ?? [])
          .filter((t) => t?.id && !t.deletedAt && t.projectId === projectId)
          .map((t) => t.id);
        const normalized = normalizePromptIaPayload(extracted.json, {
          existingTemplateIds,
          existingBaseMapIds: (detailBaseMaps ?? []).map((b) => b.id),
          newId: nanoid,
        });
        if (normalized.error) throw new Error(normalized.error);

        let payload = normalized.payload;
        let dropped = [];
        if (normalized.coordinateSpace === "pdf_user_space") {
          const pdf = await loadSourcePdf({ baseMap: mainBaseMap, projectId });
          if (!pdf.file)
            throw new Error(
              `Coordonnées « pdf_user_space » impossibles à convertir : ${pdf.reason}`
            );
          const page = await readPdfPageFrame(pdf.file, pdf.frame.pageNumber);
          const converted = convertPayloadToImageSpace(payload, pdf.frame, page);
          payload = converted.data;
          dropped = converted.dropped;
          if (
            !payload.annotations?.length &&
            !payload.baseMaps?.length &&
            dropped.length
          )
            throw new Error(
              `Toutes les annotations (${dropped.length}) tombent hors du cadre du fond (page ${pdf.frame.pageNumber}, rotation ${pdf.frame.rotation}°). Vérifiez l’espace de coordonnées et la page.`
            );
        }

        const parsed = parseImportAnnotationsJson(JSON.stringify(payload));
        if (!parsed.ok) throw new Error(parsed.error ?? "JSON invalide.");

        return {
          ok: true,
          prepared: {
            data: parsed.data,
            reusedTemplateIds: normalized.reusedTemplateIds,
            reusedBaseMapIds: normalized.reusedBaseMapIds,
            droppedIds: dropped,
            coordinateSpace: normalized.coordinateSpace,
            note: normalized.note,
            // the preview only holds for this target
            listingId,
            baseMapId: mainBaseMap.id,
            preview: buildPreview({ data: parsed.data, normalized, dropped }),
          },
        };
      } catch (err) {
        console.error("[promptIa] prepare failed", err);
        const msg = err?.message ?? String(err);
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [projectId, listingId, mainBaseMap, templates, detailBaseMaps]
  );

  const apply = useCallback(
    async (prepared) => {
      if (busyRef.current) return { ok: false, error: "Import en cours." };
      if (
        !prepared ||
        prepared.listingId !== listingId ||
        prepared.baseMapId !== mainBaseMap?.id
      ) {
        const msg =
          "Le fond de plan ou la liste a changé : collez à nouveau le résultat.";
        setError(msg);
        return { ok: false, error: msg };
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const batchId = nanoid();
        const result = await importAnnotationsInlineJsonService({
          data: prepared.data,
          projectId,
          listingId,
          mainBaseMap,
          widthMeters: prepared.data.image?.widthMeters,
          relativeToBaseMap: true,
          preserveIds: true,
          annotationProps: { promptIaBatchId: batchId },
          templateProps: { promptIaBatchId: batchId },
          baseMapProps: { promptIaBatchId: batchId },
          createdBy: userEmail ?? null,
          // Prompt IA attachments are project resources: the attachment id
          // of contexte.json is the resource id.
          resolveAttachment: async (attachmentId) => {
            const resource = await db.resources.get(attachmentId);
            return resource &&
              !resource.deletedAt &&
              resource.projectId === projectId
              ? resource.id
              : null;
          },
          dispatch,
        });
        const summary = {
          batchId,
          placedIds: (result.placed ?? []).map((a) => a.id),
          createdTemplateIds: result.createdTemplateIds ?? [],
          reusedTemplateIds: prepared.reusedTemplateIds,
          createdBaseMapIds: result.createdBaseMapIds ?? [],
          reusedBaseMapIds: [
            ...prepared.reusedBaseMapIds,
            ...(result.reusedBaseMapIds ?? []),
          ],
          droppedIds: prepared.droppedIds,
          coordinateSpace: prepared.coordinateSpace,
          note: prepared.note,
          listingId,
        };
        setLastResult(summary);
        return { ok: true, result: summary };
      } catch (err) {
        console.error("[promptIa] apply failed", err);
        const msg = err?.message ?? String(err);
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [dispatch, projectId, listingId, mainBaseMap, userEmail]
  );

  // Removes what the last paste created: its annotations, then its templates
  // and detail baseMaps when nothing else uses them (same rule as the relay's
  // live undo).
  const undo = useCallback(async () => {
    if (!lastResult || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (lastResult.placedIds.length)
        await deleteAnnotations(lastResult.placedIds);
      let touched = false;
      for (const id of lastResult.createdTemplateIds) {
        const used = await db.annotations
          .where("annotationTemplateId")
          .equals(id)
          .filter((a) => !a.deletedAt)
          .count();
        if (used > 0) continue;
        await db.annotationTemplates.delete(id);
        touched = true;
      }
      if (touched) dispatch(triggerAnnotationTemplatesUpdate());
      for (const id of lastResult.createdBaseMapIds ?? []) {
        const linked = await db.annotations
          .filter((a) => a.detailBaseMapId === id && !a.deletedAt)
          .count();
        if (linked > 0) continue;
        const record = await db.baseMaps.get(id);
        if (!record || record.deletedAt) continue;
        await deleteBaseMap(record);
        if (editor.baseMapsCache) delete editor.baseMapsCache[id];
      }
      setLastResult(null);
    } catch (err) {
      console.error("[promptIa] undo failed", err);
      setError(err?.message ?? String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [dispatch, deleteAnnotations, deleteBaseMap, lastResult]);

  const clearError = useCallback(() => setError(null), []);

  return { prepare, apply, undo, busy, error, lastResult, clearError };
}
