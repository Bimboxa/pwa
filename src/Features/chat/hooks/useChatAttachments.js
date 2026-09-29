import { useCallback } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  addAttachment,
  removeAttachment as removeAttachmentAction,
  updateAttachment,
} from "../chatSlice";

import db from "App/db/db";

import {
  describeRelayError,
  uploadRelayPdf,
} from "Features/assistantRelay/services/assistantRelayClient";
import testIsPdf from "Features/pdf/utils/testIsPdf";
import {
  describeTooLarge,
  isResourceFileTooLarge,
} from "Features/resources/constants/resourceLimits";
import useCreateResourcesFromFiles from "Features/resources/hooks/useCreateResourcesFromFiles";

import { MAX_CHAT_PDFS } from "../utils/chatAttachments";

// PDFs attached to the conversation (a "carnet de détails"…). A dropped PDF
// becomes a project resource (what detail baseMaps are rendered from) AND is
// uploaded to the relay, where the model's tools read it by pdfId.
//
// Every function returns { ok: true } or { ok: false, error } (French).
export default function useChatAttachments() {
  const dispatch = useDispatch();
  const store = useStore();
  const attachments = useSelector((s) => s.chat.attachments);
  const createResourcesFromFiles = useCreateResourcesFromFiles();

  const upload = useCallback(
    async (resource, file) => {
      dispatch(
        addAttachment({
          id: resource.id,
          name: resource.name,
          byteSize: file.size,
          pageCount: null,
          status: "uploading",
          pdfId: null,
          error: null,
        })
      );
      try {
        const pdf = await uploadRelayPdf(file);
        // Kept on the resource: a later job naming this pdfId finds the file
        // without downloading it again, even after a reload.
        await db.resources.update(resource.id, { relayPdfId: pdf.pdfId });
        dispatch(
          updateAttachment({
            id: resource.id,
            changes: {
              status: "ready",
              pdfId: pdf.pdfId,
              pageCount: pdf.pageCount ?? null,
            },
          })
        );
        return { ok: true };
      } catch (e) {
        console.log("[chat] attachment upload failed", e);
        const error = e?.code ? describeRelayError(e) : String(e?.message ?? e);
        dispatch(
          updateAttachment({
            id: resource.id,
            changes: { status: "error", error },
          })
        );
        return { ok: false, error };
      }
    },
    [dispatch]
  );

  const hasRoom = useCallback(
    () => store.getState().chat.attachments.length < MAX_CHAT_PDFS,
    [store]
  );

  const attachPdf = useCallback(
    async (file) => {
      if (!file) return { ok: false, error: null };
      if (!testIsPdf(file))
        return {
          ok: false,
          error: "Seuls les PDF et les images (PNG, JPEG, WebP) sont acceptés.",
        };
      if (isResourceFileTooLarge(file))
        return { ok: false, error: describeTooLarge(file) };
      if (!hasRoom())
        return {
          ok: false,
          error: `${MAX_CHAT_PDFS} PDF au maximum par conversation.`,
        };
      let resource;
      try {
        [resource] = await createResourcesFromFiles([file], {
          visibility: "SCOPE",
        });
      } catch (e) {
        return { ok: false, error: e?.message ?? String(e) };
      }
      if (!resource)
        return { ok: false, error: "Aucun projet sélectionné." };
      return upload(resource, file);
    },
    [createResourcesFromFiles, hasRoom, upload]
  );

  // A PDF already in the project's resources. Returns false when its file is
  // missing (DialogSelectPdfResource then shows its hint).
  const attachResource = useCallback(
    async (resource) => {
      if (!resource?.id) return false;
      if (store.getState().chat.attachments.some((a) => a.id === resource.id))
        return true;
      if (!hasRoom()) return false;
      const record = resource.fileName
        ? await db.files.get(resource.fileName)
        : null;
      if (!record?.fileArrayBuffer) return false;
      const file = new File([record.fileArrayBuffer], resource.name, {
        type: record.fileMime || "application/pdf",
      });
      // Not awaited: the chip shows the upload.
      upload(resource, file);
      return true;
    },
    [hasRoom, store, upload]
  );

  // The resource stays in the project: only the conversation lets go of it.
  const removeAttachment = useCallback(
    (id) => dispatch(removeAttachmentAction(id)),
    [dispatch]
  );

  return { attachments, attachPdf, attachResource, removeAttachment };
}
