import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import useCaptureSessionContext from "./useCaptureSessionContext";

import {
  addMessage,
  appendMessageAction,
  appendMessageContent,
  setConversation,
  setIsThinking,
  updateMessageById,
} from "../chatSlice";

import { groupDetectionDebug } from "../utils/groupDetectionDebug";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import {
  detectionArchiveKey,
  saveDetectionDebug,
} from "../services/detectionDebugStore";
import { updateChatProgress } from "../utils/chatProgress";
import { chatPlanSource } from "../utils/chatPlanSource";
import resolveAiTaskSource from "Features/aiTasks/services/resolveAiTaskSource";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import {
  buildExistingAnnotations,
  getVisibleListingTemplates,
} from "../utils/buildAutoDetectionContext";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAssistantRelayConfig from "Features/assistantRelay/hooks/useAssistantRelayConfig";
import buildBaseMapSnapshotImage from "Features/assistantRelay/services/buildBaseMapSnapshotImage";
import { buildBaseMapContext } from "Features/assistantRelay/services/publishBaseMapSnapshotService";
import {
  describeRelayError,
  streamChatTurn,
  uploadSnapshotImage,
  attachSnapshotPdf,
} from "Features/assistantRelay/services/assistantRelayClient";

// A message typed in the chat (no PDF attached) = one conversational turn on
// the relay. The displayed base map goes along as CONTEXT only (size, scale,
// listing, templates): "dessine un carré de 2 m" never moves a picture. When
// the model decides it must look at the plan, the relay says `need_image` and
// the picture is uploaded then — once per image version.
export default function useSendChatTurn() {
  const dispatch = useDispatch();
  const captureContext = useCaptureSessionContext();
  const config = useAssistantRelayConfig();
  const mainBaseMap = useMainBaseMap();
  const { value: listing } = useSelectedListing();
  const templates = useAnnotationTemplates();
  const annotations = useAnnotationsV2({
    caller: "useSendChatTurn",
    enabled: Boolean(mainBaseMap?.id && listing?.id),
    filterByMainBaseMap: true,
    filterBySelectedListing: true,
    filterBySelectedScope: true,
  });

  const userProfile = useSelector((s) => s.auth.userProfile);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const conversation = useSelector((s) => s.chat.conversation);
  const blockPlanImage = useSelector((s) => s.chat.blockPlanImage);
  const levels = useSelector((s) => s.chat.reasoningLevels);
  const levelId = useSelector((s) => s.chat.reasoningLevelId);
  const selectedTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const busy = useRef(false);

  // "Nouvelle session" while a turn is streaming: stop listening to it and
  // keep it out of the new session.
  const sessionId = useSelector((s) => s.chat.sessionId);
  const sessionRef = useRef(sessionId);
  const abortRef = useRef(null);
  const stopRef = useRef(null);
  const [pausedTurn, setPausedTurn] = useState(null);
  const stopChatTurn = useCallback(() => stopRef.current?.(), []);
  useEffect(() => {
    sessionRef.current = sessionId;
    abortRef.current?.abort();
    abortRef.current = null;
    stopRef.current = null;
    setPausedTurn(null);
  }, [sessionId]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendChatTurn = useCallback(
    // images: pictures attached to the message (prepareChatImage).
    async (text, { images = [], autoDetect = false, interruptedTurn } = {}) => {
      const message = (text ?? "").trim();
      if (!message || busy.current) return { ok: false };
      const session = captureContext();
      busy.current = true;
      setPausedTurn(null);
      const turnSession = sessionRef.current;
      const isStale = () => sessionRef.current !== turnSession;
      const controller = new AbortController();
      abortRef.current = controller;
      const messageId = uuidv4();
      let assistantText = "";
      let reasoningSummary = "";
      const actions = new Map();
      const debugRecords = new Map();
      const archiveKey = detectionArchiveKey(
        getUserIdMaster(userProfile),
        projectId,
        mainBaseMap?.id
      );
      let debugSaves = Promise.resolve();
      let latestDebug = null;
      const publishDebug = (status = "in_progress") => {
        if (!debugRecords.size) return;
        latestDebug = {
          ...groupDetectionDebug([...debugRecords.values()])[0],
          status,
          updatedAt: Date.now(),
        };
        const record = latestDebug;
        if (!isStale())
          dispatch(
            updateMessageById({
              id: messageId,
              changes: { detectionDebug: [record] },
            })
          );
        debugSaves = debugSaves
          .then(() => saveDetectionDebug(record))
          .catch((error) => {
            latestDebug = {
              ...latestDebug,
              saveError: error?.message ?? "Stockage indisponible",
            };
            if (!isStale())
              dispatch(
                updateMessageById({
                  id: messageId,
                  changes: { detectionDebug: [latestDebug] },
                })
              );
          });
      };

      dispatch(
        addMessage({
          id: uuidv4(),
          role: "user",
          content: message,
          // Only the small previews stay in the conversation.
          ...(images.length
            ? {
                images: images.map(({ name, thumbUrl }) => ({
                  name,
                  thumbUrl,
                })),
              }
            : {}),
        })
      );
      dispatch(setIsThinking(true));
      let started = false;
      const ensureBubble = () => {
        if (started || isStale()) return;
        started = true;
        dispatch(setIsThinking(false));
        dispatch(
          addMessage({
            id: messageId,
            role: "assistant",
            type: "assistant",
            content: "",
            actions: [],
          })
        );
      };
      const setError = (error) => {
        if (isStale() || controller.signal.aborted) return;
        ensureBubble();
        dispatch(updateMessageById({ id: messageId, changes: { error } }));
      };

      let progress = { startedAt: Date.now(), stage: "preparing" };
      const reportProgress = (event) => {
        if (isStale() || controller.signal.aborted) return;
        ensureBubble();
        progress = updateChatProgress(
          progress,
          typeof event === "string" ? { stage: event } : event
        );
        dispatch(
          updateMessageById({
            id: messageId,
            changes: { progress, planStatus: progress.planStatus },
          })
        );
      };
      reportProgress("preparing");

      const stop = () => {
        if (controller.signal.aborted || isStale()) return;
        controller.abort();
        ensureBubble();
        dispatch(setIsThinking(false));
        dispatch(
          updateMessageById({
            id: messageId,
            changes: { stopped: true, progress: null },
          })
        );
        setPausedTurn({
          baseMapId: mainBaseMap?.id,
          listingId: listing?.id,
          options: {
            images,
            autoDetect,
            interruptedTurn: {
              request: interruptedTurn?.request ?? message,
              assistantText: [interruptedTurn?.assistantText, assistantText]
                .filter(Boolean)
                .join("\n")
                .slice(-64000),
              actions: [
                ...(interruptedTurn?.actions ?? []),
                ...actions.values(),
              ],
            },
          },
        });
      };
      stopRef.current = stop;

      try {
        const visibleTemplates = getVisibleListingTemplates(
          templates,
          listing?.id
        );
        if (
          autoDetect &&
          (!mainBaseMap?.id ||
            !listing?.id ||
            ((autoDetect === true || autoDetect.currentListing) &&
              !visibleTemplates.length))
        )
          throw new Error(
            "Sélectionnez un fond et une liste contenant des modèles visibles."
          );
        let baseMap = null;
        if (mainBaseMap?.id) {
          baseMap = buildBaseMapContext({
            baseMap: mainBaseMap,
            projectId,
            scopeId,
            listingId: listing?.id,
            templates: autoDetect ? visibleTemplates : templates,
            config,
          });
        }

        if (autoDetect && !baseMap?.meterByPx)
          throw new Error(
            "Calibrez le fond de plan avant de lancer le repérage automatique."
          );

        // Metadata only; source bytes are resolved after a server request.
        const planSource = chatPlanSource(mainBaseMap);
        const planPdf = planSource.planPdf;
        if (baseMap && planSource.sourceFrame)
          baseMap.sourceFrame = planSource.sourceFrame;
        if (controller.signal.aborted || isStale()) return { ok: false };

        // The model asked to see the plan and the relay does not have this
        // picture yet.
        const sendImage = async (snapshotId) => {
          try {
            reportProgress("preparing_image");
            const image = await buildBaseMapSnapshotImage({
              baseMap: mainBaseMap,
              maxLongEdge: config?.maxImageLongEdge ?? 1600,
              jpegQuality: config?.jpegQuality ?? 0.8,
            });
            if (controller.signal.aborted || isStale()) return;
            reportProgress("uploading_image");
            await uploadSnapshotImage(snapshotId, image);
            reportProgress("image_ready");
          } catch (e) {
            console.log("[chat] plan picture upload failed", e);
            setError(
              `Image du plan non envoyée : ${
                e?.code ? describeRelayError(e) : e?.message
              }`
            );
          }
        };

        let pdfUpload;
        const sendPdf = (snapshotId) => {
          pdfUpload ??= (async () => {
            try {
              reportProgress("preparing_pdf");
              const source = await resolveAiTaskSource({
                baseMap: mainBaseMap,
                projectId,
                scopeId,
                listingId: listing?.id,
                config,
                onProgress: reportProgress,
              });
              if (controller.signal.aborted || isStale()) return;
              await attachSnapshotPdf(snapshotId, {
                pdfId: source.pdfId,
                imageKey: baseMap.imageKey,
              });
            } catch (error) {
              if (controller.signal.aborted || isStale()) return;
              setError(
                `PDF source indisponible : ${error?.message ?? "erreur de chargement"}`
              );
              controller.abort();
            }
          })();
          return pdfUpload;
        };

        reportProgress("connecting");
        await streamChatTurn(
          {
            message,
            autoDetect,
            planKind: planSource.planKind,
            ...(planPdf ? { planPdf } : {}),
            sessionId: session.budgetSessionId,
            ...(session.sessionName
              ? { sessionName: session.sessionName }
              : {}),
            // The turn starts on the relay's fast level; the level picked in
            // the chat takes over when the plan must be looked at.
            ...(levelId && levels.some((l) => l.id === levelId)
              ? { level: levelId }
              : {}),
            previousResponseId: conversation.previousResponseId,
            ...(baseMap ? { baseMap } : {}),
            ...(images.length
              ? {
                  images: images.map(({ mime, base64, name }) => ({
                    mime,
                    base64,
                    name: name ?? null,
                  })),
                }
              : {}),
            allowImage: Boolean(autoDetect) || !blockPlanImage,
            imageKeyInConversation: conversation.imageKey,
            context: {
              ...(interruptedTurn ? { interruptedTurn } : {}),
              listingName: listing?.name ?? null,
              selectedTemplateId: autoDetect
                ? null
                : (selectedTemplateId ?? null),
              templateGuides: visibleTemplates.map((t) => ({
                id: t.id,
                description:
                  typeof t.description === "string" ? t.description : "",
              })),
              existingAnnotations: buildExistingAnnotations(
                annotations,
                listing?.id,
                mainBaseMap?.id
              ),
            },
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (isStale() || controller.signal.aborted) return;
              if (event.type === "detection_debug") {
                ensureBubble();
                const record = {
                  id: `${messageId}:${event.artifact.stage}:${event.artifact.id}`,
                  messageId,
                  archiveKey,
                  listingId: listing?.id ?? null,
                  createdAt: Date.now(),
                  artifact: event.artifact,
                };
                debugRecords.set(record.id, record);
                publishDebug();
              } else if (event.type === "progress") {
                reportProgress(event);
              } else if (event.type === "tokens") {
                ensureBubble();
                dispatch(
                  updateMessageById({
                    id: messageId,
                    changes: { tokenUsage: event.usage },
                  })
                );
              } else if (event.type === "reasoning") {
                ensureBubble();
                reasoningSummary = (reasoningSummary + event.delta).slice(
                  -12000
                );
                dispatch(
                  updateMessageById({
                    id: messageId,
                    changes: { reasoningSummary },
                  })
                );
              } else if (event.type === "session") {
                dispatch(
                  setConversation({
                    budgetSessionId: event.sessionId,
                    sessionName: event.sessionName,
                  })
                );
              } else if (event.type === "text") {
                if (progress.stage !== "answering") reportProgress("answering");
                assistantText += event.delta;
                ensureBubble();
                dispatch(
                  appendMessageContent({ id: messageId, delta: event.delta })
                );
              } else if (event.type === "tool") {
                if (
                  event.phase === "started" &&
                  event.name !== "request_plan_image"
                )
                  reportProgress("tools");
                actions.set(event.callId, {
                  name: event.name,
                  phase: event.phase,
                  jobId: event.jobId ?? null,
                  liveStatus: event.liveStatus ?? null,
                });
                ensureBubble();
                dispatch(
                  appendMessageAction({ id: messageId, toolAction: event })
                );
              } else if (event.type === "need_pdf") {
                sendPdf(event.snapshotId);
              } else if (event.type === "need_image") {
                sendImage(event.snapshotId);
              } else if (event.type === "done") {
                ensureBubble();
                dispatch(
                  setConversation({
                    previousResponseId: event.responseId,
                    ...(event.imageAttached && baseMap
                      ? { imageKey: baseMap.imageKey }
                      : {}),
                  })
                );
                dispatch(
                  updateMessageById({
                    id: messageId,
                    changes: {
                      durationMs: event.durationMs,
                      models: event.models,
                    },
                  })
                );
              } else if (event.type === "error") {
                setError(event.message);
              }
            },
          }
        );
        return { ok: !controller.signal.aborted };
      } catch (e) {
        if (controller.signal.aborted) return { ok: false };
        console.log("[chat] turn failed", e);
        setError(e?.code ? describeRelayError(e) : e?.message);
        return { ok: false };
      } finally {
        publishDebug(controller.signal.aborted ? "interrupted" : "finished");
        busy.current = false;
        if (abortRef.current === controller) abortRef.current = null;
        if (stopRef.current === stop) stopRef.current = null;
        if (!isStale()) {
          dispatch(setIsThinking(false));
          dispatch(
            updateMessageById({ id: messageId, changes: { progress: null } })
          );
        }
      }
    },
    [
      dispatch,
      captureContext,
      config,
      mainBaseMap,
      userProfile,
      projectId,
      scopeId,
      listing,
      templates,
      annotations,
      conversation,
      blockPlanImage,
      levels,
      levelId,
      selectedTemplateId,
    ]
  );
  const canResume = Boolean(
    pausedTurn &&
    pausedTurn.baseMapId === mainBaseMap?.id &&
    pausedTurn.listingId === listing?.id
  );
  const resumeChatTurn = useCallback(() => {
    if (!canResume) return Promise.resolve({ ok: false });
    return sendChatTurn(
      "Reprends la demande interrompue en tenant compte des résultats déjà reçus, sans répéter les actions effectuées.",
      pausedTurn.options
    );
  }, [canResume, pausedTurn, sendChatTurn]);
  return { sendChatTurn, stopChatTurn, resumeChatTurn, canResume };
}
