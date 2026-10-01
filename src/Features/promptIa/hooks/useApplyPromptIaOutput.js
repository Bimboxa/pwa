import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import editor from "App/editor";
import { withoutUndo } from "App/db/undoManager";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  triggerRelsBusinessObjectResourceUpdate,
} from "Features/businessObjects/businessObjectsSlice";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";
import useDeleteBaseMap, {
  countBaseMapAnnotations,
} from "Features/baseMaps/hooks/useDeleteBaseMap";
import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";
import parseImportAnnotationsJson from "Features/importAnnotations/utils/parseImportAnnotationsJson";
import importAnnotationsInlineJsonService from "Features/importAnnotations/services/importAnnotationsInlineJsonService";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDeleteListing from "Features/listings/hooks/useDeleteListing";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import applyPromptIaExtendedResultService from "../services/applyPromptIaExtendedResultService";
import loadSourcePdf from "../services/loadSourcePdf";
import readPdfPageFrame from "../services/readPdfPageFrame";
import readPromptIaResultZip from "../services/readPromptIaResultZip";
import {
  extractJsonText,
  normalizePromptIaPayload,
} from "../utils/parsePromptIaOutput";
import parsePromptIaResult, {
  hasExtendedKeys,
} from "../utils/parsePromptIaResult";
import { convertPayloadToImageSpace } from "../utils/pdfUserSpaceToImage";

const isZipFile = (file) =>
  /\.zip$/i.test(file?.name ?? "") ||
  ["application/zip", "application/x-zip-compressed"].includes(file?.type);

// What the result will create, for the preview shown before the import.
// `legacy` = the historical part (displayed base map + current listing),
// `extended` = base maps / listings / issues the model adds to the scope.
function buildPreview({ legacy, extended }) {
  const data = legacy?.data ?? {};
  const templates = Array.isArray(data.annotationTemplates)
    ? data.annotationTemplates
    : [];
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  const reused = new Set(legacy?.reusedTemplateIds ?? []);
  const countByTemplateId = new Map();
  const count = (annotation) => {
    const id = annotation?.annotationTemplateId ?? null;
    countByTemplateId.set(id, (countByTemplateId.get(id) ?? 0) + 1);
  };
  annotations.forEach(count);
  const listings = extended?.listings ?? [];
  listings.forEach((listing) => listing.annotations.forEach(count));

  return {
    annotations:
      annotations.length +
      listings.reduce((n, l) => n + l.annotations.length, 0),
    newTemplates:
      templates.filter((t) => !reused.has(t.id)).length +
      listings.reduce((n, l) => n + l.annotationTemplates.length, 0),
    reusedTemplates: reused.size,
    newBaseMaps: Array.isArray(data.baseMaps) ? data.baseMaps.length : 0,
    reusedBaseMaps: legacy?.reusedBaseMapIds.length ?? 0,
    newPlanBaseMaps: (extended?.baseMaps ?? []).map((b) => b.name),
    newListings: listings.map((l) => l.name),
    issues: extended?.issues.length ?? 0,
    warnings: extended?.warnings ?? [],
    // something lands in the current listing, on the displayed base map
    hasLegacy: Boolean(legacy),
    dropped: legacy?.droppedIds.length ?? 0,
    note: legacy?.note ?? extended?.note ?? null,
    byTemplate: [
      ...templates.map((t) => ({
        id: t.id,
        label: t.label ?? t.name ?? t.type,
        isNew: !reused.has(t.id),
        count: countByTemplateId.get(t.id) ?? 0,
      })),
      ...listings.flatMap((listing) =>
        listing.annotationTemplates.map((t) => ({
          id: t.id,
          label: `${listing.name} › ${t.label ?? t.name ?? t.type}`,
          isNew: true,
          count: countByTemplateId.get(t.id) ?? 0,
        }))
      ),
    ].filter((row) => row.count > 0 || row.isNew),
  };
}

/**
 * Reads the result given back by an external AI chat (Prompt IA zip), then
 * applies it, and undoes the last application. Two phases, so the screen can
 * show a preview in between:
 *
 * prepare(source) → { ok, prepared } | { ok: false, error } — nothing written
 * apply(prepared) → { ok, result } | { ok: false, error }
 *
 * `source` = the pasted text, or a dropped file: a `.json` / `.txt`, or the
 * zip (`resultat.json` + the files of the base maps the model created).
 *
 * The historical keys go to the displayed base map and the current listing.
 * The extended ones (parsePromptIaResult) create base maps from CAD / BIM
 * sources, one annotation listing per source and the issues of the scope.
 */
export default function useApplyPromptIaOutput() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const userProfile = useSelector((s) => s.auth.userProfile);
  const mainBaseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const appConfig = useAppConfig();
  const { value: scope } = useSelectedScope();
  const deleteAnnotations = useDeleteAnnotations();
  const deleteBaseMap = useDeleteBaseMap();
  const deleteListing = useDeleteListing();
  const createBaseMaps = useCreateBaseMaps();
  const createListings = useCreateListings();
  const detailBaseMaps = useDetailBaseMaps();
  const { value: userEmail } = useUserEmail();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const busyRef = useRef(false);

  // helpers

  // Historical part: normalized, converted to the image frame, validated.
  async function prepareLegacy(json) {
    const existingTemplateIds = (templates ?? [])
      .filter((t) => t?.id && !t.deletedAt && t.projectId === projectId)
      .map((t) => t.id);
    const normalized = normalizePromptIaPayload(json, {
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
      data: parsed.data,
      reusedTemplateIds: normalized.reusedTemplateIds,
      reusedBaseMapIds: normalized.reusedBaseMapIds,
      droppedIds: dropped,
      coordinateSpace: normalized.coordinateSpace,
      note: normalized.note,
    };
  }

  const prepare = useCallback(
    async (source) => {
      const fail = (msg) => {
        setError(msg);
        return { ok: false, error: msg };
      };

      let text = source;
      let zip = null;
      if (typeof source !== "string") {
        try {
          if (isZipFile(source)) {
            zip = await readPromptIaResultZip(source);
            if (!zip.ok) return fail(zip.error);
            text = zip.text;
          } else text = await source.text();
        } catch (err) {
          return fail(`Fichier illisible : ${err?.message ?? String(err)}`);
        }
      }

      const extracted = extractJsonText(text);
      if (!extracted.ok) return fail(extracted.error);
      if (!projectId || !listingId || !mainBaseMap?.id)
        return fail(
          "Sélectionnez un fond de plan et une liste avant de coller."
        );
      setError(null);
      try {
        let legacyJson = extracted.json;
        let extended = null;
        if (hasExtendedKeys(extracted.json)) {
          // any resource of the project may be linked by an issue
          const attachmentIds = (
            await db.resources.where("projectId").equals(projectId).toArray()
          )
            .filter((r) => !r.deletedAt)
            .map((r) => r.id);
          const parsed = parsePromptIaResult(extracted.json, {
            zipPaths: zip?.zipPaths ?? null,
            attachmentIds,
            newId: nanoid,
          });
          if (!parsed.ok) throw new Error(parsed.error);
          legacyJson = parsed.legacy;
          extended = { ...parsed, getFile: zip?.getFile ?? null };
        }
        const legacy = legacyJson ? await prepareLegacy(legacyJson) : null;

        return {
          ok: true,
          prepared: {
            legacy,
            extended,
            // the preview only holds for this target
            listingId,
            baseMapId: mainBaseMap.id,
            preview: buildPreview({ legacy, extended }),
          },
        };
      } catch (err) {
        console.error("[promptIa] prepare failed", err);
        return fail(err?.message ?? String(err));
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
      if (prepared.extended && !scope?.id) {
        const msg = "Sélectionnez un scope avant d’importer.";
        setError(msg);
        return { ok: false, error: msg };
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const batchId = nanoid();
        const { legacy, extended } = prepared;
        // annotation id of the result → row written, for the issue links
        const placedAnnotationById = new Map();

        let result = null;
        if (legacy) {
          const annotationIdMapOut = new Map();
          result = await importAnnotationsInlineJsonService({
            data: legacy.data,
            projectId,
            listingId,
            mainBaseMap,
            widthMeters: legacy.data.image?.widthMeters,
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
            annotationIdMapOut,
            dispatch,
          });
          const rowById = new Map((result.placed ?? []).map((a) => [a.id, a]));
          for (const [authorId, id] of annotationIdMapOut)
            if (rowById.has(id))
              placedAnnotationById.set(authorId, rowById.get(id));
        }

        let added = null;
        if (extended) {
          const debugAuth = getDebugAuthFromLocalStorage();
          await withoutUndo(async () => {
            added = await applyPromptIaExtendedResultService({
              parsed: extended,
              getFile: extended.getFile,
              projectId,
              scope,
              mainBaseMap,
              appConfig,
              createBaseMaps,
              createListings,
              createdBy: {
                idMaster:
                  userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
                trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
              },
              userEmail,
              batchId,
              placedAnnotationById,
              dispatch,
            });
          });
        }

        const summary = {
          batchId,
          placedIds: [
            ...(result?.placed ?? []).map((a) => a.id),
            ...(added?.placedIds ?? []),
          ],
          createdTemplateIds: [
            ...(result?.createdTemplateIds ?? []),
            ...(added?.templateIds ?? []),
          ],
          reusedTemplateIds: legacy?.reusedTemplateIds ?? [],
          createdBaseMapIds: result?.createdBaseMapIds ?? [],
          reusedBaseMapIds: [
            ...(legacy?.reusedBaseMapIds ?? []),
            ...(result?.reusedBaseMapIds ?? []),
          ],
          createdPlanBaseMapIds: added?.baseMapIds ?? [],
          createdListingIds: added?.listingIds ?? [],
          createdIssueIds: added?.issueIds ?? [],
          issuesListingId: added?.issuesListingId ?? null,
          createdIssuesListing: added?.createdIssuesListing ?? false,
          droppedCount:
            (legacy?.droppedIds.length ?? 0) + (added?.dropped ?? 0),
          errors: added?.errors ?? [],
          warnings: extended?.warnings ?? [],
          coordinateSpace: legacy?.coordinateSpace ?? null,
          note: legacy?.note ?? extended?.note ?? null,
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
    [
      dispatch,
      projectId,
      listingId,
      mainBaseMap,
      userEmail,
      userProfile,
      scope,
      appConfig,
      createBaseMaps,
      createListings,
    ]
  );

  // Removes what the last import created: its annotations, then its
  // templates, detail baseMaps, listings and plan base maps when nothing else
  // uses them (same rule as the relay's live undo), and its issues.
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

      // listings of the batch: kept when the user drew in them since
      for (const id of lastResult.createdListingIds ?? []) {
        const used = await db.annotations
          .where("listingId")
          .equals(id)
          .filter((a) => !a.deletedAt)
          .count();
        if (used > 0) continue;
        await db.annotationTemplates.where("listingId").equals(id).delete();
        await deleteListing(id, { keepSelection: true });
      }
      // plan base maps of the batch: same rule
      for (const id of lastResult.createdPlanBaseMapIds ?? []) {
        if ((await countBaseMapAnnotations(id)) > 0) continue;
        const record = await db.baseMaps.get(id);
        if (!record || record.deletedAt) continue;
        await deleteBaseMap(record);
        if (editor.baseMapsCache) delete editor.baseMapsCache[id];
      }

      const issueIds = lastResult.createdIssueIds ?? [];
      if (issueIds.length) {
        await db.transaction(
          "rw",
          db.businessObjects,
          db.relsBusinessObjectAnnotation,
          db.relsBusinessObjectResource,
          async () => {
            await db.businessObjects.bulkDelete(issueIds);
            await db.relsBusinessObjectAnnotation
              .where("businessObjectId")
              .anyOf(issueIds)
              .delete();
            await db.relsBusinessObjectResource
              .where("businessObjectId")
              .anyOf(issueIds)
              .delete();
          }
        );
        // the listing this batch created, when nothing else was added to it
        if (lastResult.createdIssuesListing && lastResult.issuesListingId) {
          const left = await db.businessObjects
            .where("listingId")
            .equals(lastResult.issuesListingId)
            .filter((o) => !o.deletedAt)
            .count();
          if (left === 0)
            await deleteListing(lastResult.issuesListingId, {
              keepSelection: true,
            });
        }
        dispatch(triggerBusinessObjectsUpdate());
        dispatch(triggerRelsBusinessObjectAnnotationUpdate());
        dispatch(triggerRelsBusinessObjectResourceUpdate());
      }
      setLastResult(null);
    } catch (err) {
      console.error("[promptIa] undo failed", err);
      setError(err?.message ?? String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [dispatch, deleteAnnotations, deleteBaseMap, deleteListing, lastResult]);

  const clearError = useCallback(() => setError(null), []);

  return { prepare, apply, undo, busy, error, lastResult, clearError };
}
