import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import useCaptureSessionContext from "./useCaptureSessionContext";

import { addMessage, setPendingPdf, setVectorization } from "../chatSlice";

import useCreateBaseMapFromRelayJob from "Features/assistantRelay/hooks/useCreateBaseMapFromRelayJob";
import {
  createVectorization,
  describeRelayError,
  uploadRelayPdf,
} from "Features/assistantRelay/services/assistantRelayClient";
import { saveVectorizationPointer } from "Features/assistantRelay/utils/vectorizationPointer";

export const DEFAULT_VECTORIZATION_INSTRUCTION =
  "Vectorise les éléments structurels de cette page";

// PDF dropped in the chat → uploaded to the relay right away (the relay
// measures the pages, which feeds the page selector) → "Envoyer" launches the
// run. The destination (project, scope, base maps listing) is frozen here.
export default function useStartVectorization() {
  const dispatch = useDispatch();
  const captureContext = useCaptureSessionContext();
  const sessionId = useSelector((s) => s.chat.sessionId);
  const pendingPdf = useSelector((s) => s.chat.pendingPdf);
  const activeRun = useSelector((s) => s.chat.vectorization);
  const levels = useSelector((s) => s.chat.reasoningLevels);
  const levelId = useSelector((s) => s.chat.reasoningLevelId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { defaultListingId } = useCreateBaseMapFromRelayJob();

  const attachPdf = useCallback(
    async (file) => {
      if (!file) return;
      const isPdf =
        file.type === "application/pdf" || /\.pdf$/i.test(file.name ?? "");
      if (!isPdf) {
        dispatch(
          setPendingPdf({
            status: "error",
            fileName: file.name,
            error:
              "Seuls les PDF et les images (PNG, JPEG, WebP) sont acceptés.",
          })
        );
        return;
      }
      dispatch(setPendingPdf(null));
      dispatch(setPendingPdf({ status: "uploading", fileName: file.name }));
      try {
        const pdf = await uploadRelayPdf(file);
        dispatch(
          setPendingPdf({
            status: "ready",
            pdfId: pdf.pdfId,
            pdfByteSize: pdf.byteSize ?? file.size,
            fileName: pdf.fileName ?? file.name,
            pageCount: pdf.pageCount ?? 1,
            pageNumber: 1,
          })
        );
      } catch (e) {
        console.log("[chat] pdf upload failed", e);
        if (e?.code === "EMPTY_PDF") {
          dispatch(
            addMessage({
              id: uuidv4(),
              role: "assistant",
              content: "",
              error: describeRelayError(e),
            })
          );
        }
        dispatch(
          setPendingPdf({
            status: "error",
            error: e?.code ? describeRelayError(e) : e?.message,
          })
        );
      }
    },
    [dispatch]
  );

  const startVectorization = useCallback(
    async (instruction) => {
      if (pendingPdf?.status !== "ready") return { ok: false };
      if (!projectId) {
        dispatch(
          setPendingPdf({
            status: "error",
            error: "Aucun projet sélectionné.",
          })
        );
        return { ok: false };
      }
      const session = captureContext();
      const text =
        (instruction ?? "").trim() || DEFAULT_VECTORIZATION_INSTRUCTION;
      const target = {
        projectId,
        scopeId: scopeId ?? null,
        baseMapListingId: defaultListingId || null,
      };
      const clientRequestId = uuidv4();
      const messageId = uuidv4();
      dispatch(
        addMessage({
          id: uuidv4(),
          role: "user",
          content: `📎 ${pendingPdf.fileName}${
            pendingPdf.pageCount > 1 ? ` — page ${pendingPdf.pageNumber}` : ""
          }\n${text}`,
        })
      );
      try {
        const run = await createVectorization({
          sessionId: session.budgetSessionId,
          sessionName: (session.sessionName ?? pendingPdf.fileName).slice(
            0,
            120
          ),
          pdfId: pendingPdf.pdfId,
          pageNumber: pendingPdf.pageNumber,
          instruction: text,
          target,
          // Level of reflection; the relay picks the model.
          ...(levelId && levels.some((l) => l.id === levelId)
            ? { level: levelId }
            : {}),
          clientRequestId,
        });
        dispatch(
          addMessage({
            id: messageId,
            role: "assistant",
            type: "vectorization",
            pdfByteSize: pendingPdf.pdfByteSize,
            content: "",
            run,
          })
        );
        const pointer = {
          runId: run.runId,
          messageId,
          target,
          pdfByteSize: pendingPdf.pdfByteSize,
        };
        saveVectorizationPointer(pointer, sessionId);
        dispatch(setVectorization(pointer));
        dispatch(setPendingPdf(null));
        return { ok: true, run };
      } catch (e) {
        console.log("[chat] vectorization start failed", e);
        dispatch(
          addMessage({
            id: messageId,
            role: "assistant",
            content: e?.code ? describeRelayError(e) : String(e?.message ?? e),
          })
        );
        return { ok: false };
      }
    },
    [
      dispatch,
      captureContext,
      sessionId,
      pendingPdf,
      projectId,
      scopeId,
      defaultListingId,
      levels,
      levelId,
    ]
  );

  const clearPdf = useCallback(() => dispatch(setPendingPdf(null)), [dispatch]);
  const setPageNumber = useCallback(
    (pageNumber) => dispatch(setPendingPdf({ pageNumber })),
    [dispatch]
  );

  return {
    pendingPdf,
    hasActiveRun: Boolean(activeRun),
    attachPdf,
    clearPdf,
    setPageNumber,
    startVectorization,
  };
}
