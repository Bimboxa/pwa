import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";

import {
  addMessage,
  appendMessageAction,
  appendMessageContent,
  setConversation,
  setIsThinking,
  updateMessageById,
} from "../chatSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAssistantRelayConfig from "Features/assistantRelay/hooks/useAssistantRelayConfig";
import buildBaseMapSnapshotImage from "Features/assistantRelay/services/buildBaseMapSnapshotImage";
import { buildBaseMapContext } from "Features/assistantRelay/services/publishBaseMapSnapshotService";
import {
  describeRelayError,
  streamChatTurn,
  uploadSnapshotImage,
} from "Features/assistantRelay/services/assistantRelayClient";

// A message typed in the chat (no PDF attached) = one conversational turn on
// the relay. The displayed base map goes along as CONTEXT only (size, scale,
// listing, templates): "dessine un carré de 2 m" never moves a picture. When
// the model decides it must look at the plan, the relay says `need_image` and
// the picture is uploaded then — once per image version.
export default function useSendChatTurn() {
  const dispatch = useDispatch();
  const config = useAssistantRelayConfig();
  const mainBaseMap = useMainBaseMap();
  const { value: listing } = useSelectedListing();
  const templates = useAnnotationTemplates();

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
  useEffect(() => {
    sessionRef.current = sessionId;
    abortRef.current?.abort();
    abortRef.current = null;
  }, [sessionId]);

  return useCallback(
    // images: pictures attached to the message (prepareChatImage).
    async (text, { images = [] } = {}) => {
      const message = (text ?? "").trim();
      if (!message || busy.current) return { ok: false };
      busy.current = true;
      const turnSession = sessionRef.current;
      const isStale = () => sessionRef.current !== turnSession;
      const controller = new AbortController();
      abortRef.current = controller;
      const messageId = uuidv4();
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
        if (isStale()) return;
        ensureBubble();
        dispatch(updateMessageById({ id: messageId, changes: { error } }));
      };

      try {
        let baseMap = null;
        if (mainBaseMap?.id) {
          baseMap = buildBaseMapContext({
            baseMap: mainBaseMap,
            projectId,
            scopeId,
            listingId: listing?.id,
            templates,
            config,
          });
        }

        // The model asked to see the plan and the relay does not have this
        // picture yet.
        const sendImage = async (snapshotId) => {
          try {
            const image = await buildBaseMapSnapshotImage({
              baseMap: mainBaseMap,
              maxLongEdge: config?.maxImageLongEdge ?? 1600,
              jpegQuality: config?.jpegQuality ?? 0.8,
            });
            await uploadSnapshotImage(snapshotId, image);
          } catch (e) {
            console.log("[chat] plan picture upload failed", e);
            setError(
              `Image du plan non envoyée : ${
                e?.code ? describeRelayError(e) : e?.message
              }`
            );
          }
        };

        await streamChatTurn(
          {
            message,
            sessionId: conversation.budgetSessionId,
            ...(conversation.sessionName
              ? { sessionName: conversation.sessionName }
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
            allowImage: !blockPlanImage,
            imageKeyInConversation: conversation.imageKey,
            context: {
              listingName: listing?.name ?? null,
              selectedTemplateId: selectedTemplateId ?? null,
            },
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (isStale()) return;
              if (event.type === "session") {
                dispatch(
                  setConversation({
                    budgetSessionId: event.sessionId,
                    sessionName: event.sessionName,
                  })
                );
              } else if (event.type === "text") {
                ensureBubble();
                dispatch(
                  appendMessageContent({ id: messageId, delta: event.delta })
                );
              } else if (event.type === "tool") {
                ensureBubble();
                dispatch(
                  appendMessageAction({ id: messageId, toolAction: event })
                );
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
        return { ok: true };
      } catch (e) {
        console.log("[chat] turn failed", e);
        setError(e?.code ? describeRelayError(e) : e?.message);
        return { ok: false };
      } finally {
        busy.current = false;
        if (abortRef.current === controller) abortRef.current = null;
        if (!isStale()) dispatch(setIsThinking(false));
      }
    },
    [
      dispatch,
      config,
      mainBaseMap,
      projectId,
      scopeId,
      listing,
      templates,
      conversation,
      blockPlanImage,
      levels,
      levelId,
      selectedTemplateId,
    ]
  );
}
