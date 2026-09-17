import { useCallback, useRef } from "react";
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

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import usePublishCurrentBaseMap from "Features/assistantRelay/hooks/usePublishCurrentBaseMap";
import {
  describeRelayError,
  streamChatTurn,
} from "Features/assistantRelay/services/assistantRelayClient";

// Is the snapshot the relay holds still what the user is looking at? The
// model reads the base map, its listing and its templates from it.
function snapshotIsStale(snapshot, { baseMapId, listingId, templates }) {
  if (!snapshot) return true;
  if (snapshot.baseMapId !== baseMapId) return true;
  if ((snapshot.listingId ?? null) !== (listingId ?? null)) return true;
  const published = new Set((snapshot.templates ?? []).map((t) => t.id));
  const current = (templates ?? []).map((t) => t.id);
  return (
    current.length !== published.size ||
    current.some((id) => !published.has(id))
  );
}

// A message typed in the chat (no PDF attached) = one conversational turn on
// the relay: the model answers and acts through the relay's MCP tools; what
// it draws comes back as live jobs applied by AssistantRelayRuntime.
export default function useSendChatTurn() {
  const dispatch = useDispatch();
  const { publish, mainBaseMap } = usePublishCurrentBaseMap();
  const { value: listing } = useSelectedListing();
  const templates = useAnnotationTemplates();

  const snapshot = useSelector((s) => s.assistantRelay.currentSnapshot);
  const conversation = useSelector((s) => s.chat.conversation);
  const models = useSelector((s) => s.chat.vectorizationModels);
  const modelId = useSelector((s) => s.chat.vectorizationModelId);
  const selectedTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const busy = useRef(false);

  return useCallback(
    async (text) => {
      const message = (text ?? "").trim();
      if (!message || busy.current) return { ok: false };
      busy.current = true;
      const messageId = uuidv4();
      dispatch(addMessage({ id: uuidv4(), role: "user", content: message }));
      dispatch(setIsThinking(true));
      let started = false;
      const ensureBubble = () => {
        if (started) return;
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

      try {
        // The model works on what the relay holds: republish when the user
        // has moved to another base map / listing, or created templates.
        let current = snapshot;
        if (
          mainBaseMap?.id &&
          snapshotIsStale(snapshot, {
            baseMapId: mainBaseMap.id,
            listingId: listing?.id,
            templates,
          })
        ) {
          current = (await publish()) ?? snapshot;
        }
        const snapshotId = current?.snapshotId ?? null;
        const attachSnapshot = Boolean(
          snapshotId && snapshotId !== conversation.attachedSnapshotId
        );

        await streamChatTurn(
          {
            message,
            ...(modelId && models.some((m) => m.id === modelId)
              ? { model: modelId }
              : {}),
            previousResponseId: conversation.previousResponseId,
            attachSnapshot,
            context: {
              baseMapName: mainBaseMap?.name ?? null,
              listingId: listing?.id ?? null,
              listingName: listing?.name ?? null,
              selectedTemplateId: selectedTemplateId ?? null,
            },
          },
          {
            onEvent: (event) => {
              if (event.type === "text") {
                ensureBubble();
                dispatch(
                  appendMessageContent({ id: messageId, delta: event.delta })
                );
              } else if (event.type === "tool") {
                ensureBubble();
                dispatch(
                  appendMessageAction({ id: messageId, toolAction: event })
                );
              } else if (event.type === "done") {
                dispatch(
                  setConversation({
                    previousResponseId: event.responseId,
                    ...(attachSnapshot
                      ? { attachedSnapshotId: snapshotId }
                      : {}),
                  })
                );
              } else if (event.type === "error") {
                ensureBubble();
                dispatch(
                  updateMessageById({
                    id: messageId,
                    changes: { error: event.message },
                  })
                );
              }
            },
          }
        );
        return { ok: true };
      } catch (e) {
        console.log("[chat] turn failed", e);
        ensureBubble();
        dispatch(
          updateMessageById({
            id: messageId,
            changes: { error: e?.code ? describeRelayError(e) : e?.message },
          })
        );
        return { ok: false };
      } finally {
        busy.current = false;
        dispatch(setIsThinking(false));
      }
    },
    [
      dispatch,
      publish,
      mainBaseMap,
      listing,
      templates,
      snapshot,
      conversation,
      models,
      modelId,
      selectedTemplateId,
    ]
  );
}
