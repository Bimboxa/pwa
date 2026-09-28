import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
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

/**
 * Applies the JSON pasted back from an external AI chat (Prompt IA zip) to
 * the current base map / listing, and undoes the last application.
 *
 * apply(text) → { ok, result } | { ok: false, error }
 */
export default function useApplyPromptIaOutput() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const mainBaseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const deleteAnnotations = useDeleteAnnotations();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const busyRef = useRef(false);

  const apply = useCallback(
    async (text) => {
      if (busyRef.current) return { ok: false, error: "Import en cours." };
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
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const existingTemplateIds = (templates ?? [])
          .filter((t) => t?.id && !t.deletedAt && t.projectId === projectId)
          .map((t) => t.id);
        const normalized = normalizePromptIaPayload(extracted.json, {
          existingTemplateIds,
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
          if (!payload.annotations?.length && dropped.length)
            throw new Error(
              `Toutes les annotations (${dropped.length}) tombent hors du cadre du fond (page ${pdf.frame.pageNumber}, rotation ${pdf.frame.rotation}°). Vérifiez l’espace de coordonnées et la page.`
            );
        }

        const parsed = parseImportAnnotationsJson(JSON.stringify(payload));
        if (!parsed.ok) throw new Error(parsed.error ?? "JSON invalide.");

        const batchId = nanoid();
        const result = await importAnnotationsInlineJsonService({
          data: parsed.data,
          projectId,
          listingId,
          mainBaseMap,
          widthMeters: parsed.data.image?.widthMeters,
          relativeToBaseMap: true,
          preserveIds: true,
          annotationProps: { promptIaBatchId: batchId },
          templateProps: { promptIaBatchId: batchId },
          dispatch,
        });
        const summary = {
          batchId,
          placedIds: (result.placed ?? []).map((a) => a.id),
          createdTemplateIds: result.createdTemplateIds ?? [],
          reusedTemplateIds: normalized.reusedTemplateIds,
          droppedIds: dropped,
          coordinateSpace: normalized.coordinateSpace,
          note: normalized.note,
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
    [dispatch, projectId, listingId, mainBaseMap, templates]
  );

  // Removes what the last paste created: its annotations, then its templates
  // when nothing else uses them (same rule as the relay's live undo).
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
      setLastResult(null);
    } catch (err) {
      console.error("[promptIa] undo failed", err);
      setError(err?.message ?? String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [dispatch, deleteAnnotations, lastResult]);

  const clearError = useCallback(() => setError(null), []);

  return { apply, undo, busy, error, lastResult, clearError };
}
