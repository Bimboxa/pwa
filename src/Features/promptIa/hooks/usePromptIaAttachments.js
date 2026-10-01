import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import {
  describeTooLarge,
  isResourceFileTooLarge,
} from "Features/resources/constants/resourceLimits";
import useCreateResourcesFromFiles from "Features/resources/hooks/useCreateResourcesFromFiles";
import useResources from "Features/resources/hooks/useResources";

import { getPromptIaAttachmentRejection } from "../utils/promptIaAttachmentTypes";

/**
 * Files attached to the Prompt IA zip. An attachment IS a project resource
 * (db.resources + db.files) flagged `isPromptIaAttachment`: it survives
 * reloads, shows up in the Resources panel and is what a detail baseMap is
 * rendered from. Detaching only clears the flag. Accepted formats:
 * utils/promptIaAttachmentTypes (PDF, pictures, DXF, IFC, a few documents).
 *
 * `hasFile` is false after a Krto import (the row ships, the file does not):
 * such an attachment is listed but left out of the zip.
 */
export default function usePromptIaAttachments() {
  const resources = useResources();
  const createResourcesFromFiles = useCreateResourcesFromFiles();

  const flagged = useMemo(
    () => resources.filter((r) => r.isPromptIaAttachment),
    [resources]
  );
  const fileNames = flagged.map((r) => r.fileName).join("|");

  const present = useLiveQuery(async () => {
    const names = fileNames ? fileNames.split("|") : [];
    if (!names.length) return new Set();
    // Keys only: never load 50 MB buffers just to list the attachments.
    const keys = await db.files.where("fileName").anyOf(names).primaryKeys();
    return new Set(keys);
  }, [fileNames]);

  const attachments = useMemo(
    () =>
      flagged.map((resource) => ({
        resource,
        isPdf: resource.fileType === "PDF",
        hasFile: present ? present.has(resource.fileName) : true,
      })),
    [flagged, present]
  );

  // → { added: resource[], errors: string[] } (French messages).
  const attachFiles = useCallback(
    async (files) => {
      const errors = [];
      const kept = [];
      for (const file of Array.from(files ?? [])) {
        const rejection = getPromptIaAttachmentRejection(file);
        if (rejection) {
          errors.push(rejection);
        } else if (isResourceFileTooLarge(file)) {
          errors.push(describeTooLarge(file));
        } else {
          kept.push(file);
        }
      }
      let added = [];
      if (kept.length) {
        try {
          added = await createResourcesFromFiles(kept, {
            visibility: "SCOPE",
            props: { isPromptIaAttachment: true },
          });
        } catch (err) {
          errors.push(err?.message ?? String(err));
        }
      }
      return { added, errors };
    },
    [createResourcesFromFiles]
  );

  // A resource already in the project. Returns false when its file is
  // missing (DialogSelectPdfResource then shows its hint).
  const attachExisting = useCallback(async (resource) => {
    if (!resource?.id) return false;
    const record = resource.fileName
      ? await db.files.where("fileName").equals(resource.fileName).count()
      : 0;
    if (!record) return false;
    await db.resources.update(resource.id, { isPromptIaAttachment: true });
    return true;
  }, []);

  const detach = useCallback(async (resource) => {
    if (!resource?.id) return;
    await db.resources.update(resource.id, { isPromptIaAttachment: false });
  }, []);

  // [{ resource, file }] of the attachments whose file is present.
  const loadFiles = useCallback(async () => {
    const out = [];
    for (const { resource } of attachments) {
      const record = await db.files.get(resource.fileName);
      if (!record?.fileArrayBuffer) continue;
      out.push({
        resource,
        file: new File([record.fileArrayBuffer], resource.name, {
          type: record.fileMime || resource.fileMime || "",
        }),
      });
    }
    return out;
  }, [attachments]);

  return { attachments, attachFiles, attachExisting, detach, loadFiles };
}
