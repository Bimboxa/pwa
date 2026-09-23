import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setIsThinking } from "../chatSlice";

import { Stack, Box, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import chatDarkTheme from "../chatDarkTheme";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useSendChatTurn from "../hooks/useSendChatTurn";
import ChatInput from "./ChatInput";
import ChatAiTasks from "Features/aiTasks/components/ChatAiTasks";
import ChatMessage from "./ChatMessage";
import ChatMessageAssistant from "./ChatMessageAssistant";
import ChatMessageVectorization from "./ChatMessageVectorization";
import ChatRelayBar from "./ChatRelayBar";
import useStartVectorization from "../hooks/useStartVectorization";
import prepareChatImage, {
  isChatImageFile,
  MAX_CHAT_IMAGES,
} from "../utils/prepareChatImage";
import useAssistantRelayConfig from "Features/assistantRelay/hooks/useAssistantRelayConfig";
import ThinkingBubble from "./ThinkingBubble";
import ChatHeader from "./ChatHeader";
import SectionManagedDataByAgent from "./SectionManagedDataByAgent";

export default function PanelChat() {
  const dispatch = useDispatch();
  const {
    sendChatTurn: sendTurn,
    stopChatTurn,
    resumeChatTurn,
    canResume,
  } = useSendChatTurn();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  async function runChatTurn(callback) {
    if (sendingRef.current) return { ok: false };
    sendingRef.current = true;
    setSending(true);
    try {
      return await callback();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const sendChatTurn = (...args) => runChatTurn(() => sendTurn(...args));
  const playChatTurn = () => runChatTurn(resumeChatTurn);

  const messages = useSelector((state) => state.chat.messages);
  const isThinking = useSelector((state) => state.chat.isThinking);

  const openChat = useSelector(
    (s) => s.rightPanel.selectedMenuItemKey === "CHAT"
  );

  useEffect(() => {
    if (!openChat) {
      dispatch(setIsThinking(false));
    }
  }, [openChat]);

  // PDF drop → vectorization run through the relay (Assistant IA). Opt-out:
  // appConfig.features.assistantRelay.chatVectorization: false.
  const relayConfig = useAssistantRelayConfig();
  const canDropPdf =
    Boolean(relayConfig?.enabled && relayConfig?.relayBaseUrl) &&
    relayConfig?.chatVectorization !== false;
  const { attachPdf, pendingPdf } = useStartVectorization();

  // Pictures attached to the next message (dropped, pasted or picked). Kept
  // here, not in the store: they are heavy and only matter until "Envoyer".
  const [pendingImages, setPendingImages] = useState([]);
  const [attachError, setAttachError] = useState(null);
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;

  // "Nouvelle session" also drops what was waiting.
  const sessionId = useSelector((s) => s.chat.sessionId);
  useEffect(() => {
    setPendingImages([]);
    setAttachError(null);
  }, [sessionId]);

  // A PDF starts a vectorization, pictures go with a typed message: one or
  // the other.
  async function attachFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setAttachError(null);
    const images = files.filter(isChatImageFile);
    if (!images.length) {
      if (pendingImagesRef.current.length) {
        setAttachError(pdfWithImagesS);
        return;
      }
      attachPdf(files[0]);
      return;
    }
    if (pendingPdf) {
      setAttachError(imageWithPdfS);
      return;
    }
    const room = MAX_CHAT_IMAGES - pendingImagesRef.current.length;
    if (images.length > room) setAttachError(tooManyImagesS);
    for (const file of images.slice(0, Math.max(0, room))) {
      try {
        const image = await prepareChatImage(file);
        setPendingImages((list) =>
          list.length < MAX_CHAT_IMAGES ? [...list, image] : list
        );
      } catch (e) {
        setAttachError(e?.message ?? unreadableImageS);
      }
    }
  }

  function removeImage(id) {
    setAttachError(null);
    setPendingImages((list) => list.filter((image) => image.id !== id));
  }
  const [dragOver, setDragOver] = useState(false);
  // Pairing key form, opened from the status dot of the header.
  const [editingKey, setEditingKey] = useState(false);

  // strings

  const emptyS =
    "Demandez un dessin, une liste, des modèles… joignez une image à reproduire, ou déposez un PDF à vectoriser.";
  const dropS = "Déposer un PDF à vectoriser ou une image";
  const pdfWithImagesS = "Retirez les images pour vectoriser un PDF.";
  const imageWithPdfS = "Retirez le PDF pour joindre une image.";
  const tooManyImagesS = `${MAX_CHAT_IMAGES} images au maximum par message.`;
  const unreadableImageS = "Image illisible.";

  // The last message stays in view while the answer streams.
  const listRef = useRef(null);
  const lastMessage = messages[messages.length - 1];
  const scrollKey = `${messages.length}:${lastMessage?.content?.length ?? 0}:${lastMessage?.actions?.length ?? 0}:${isThinking}`;
  const messageCount = useRef(0);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // A new message always scrolls; streamed text only follows when the user
    // is already at the bottom (scrolling up to read is left alone).
    const isNew = messages.length !== messageCount.current;
    messageCount.current = messages.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNew || nearBottom) el.scrollTop = el.scrollHeight;
  }, [scrollKey]);
  const dragDepth = useRef(0);

  const hasFiles = (e) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  function handleDragEnter(e) {
    if (!canDropPdf || !hasFiles(e)) return;
    dragDepth.current += 1;
    setDragOver(true);
  }
  function handleDragLeave(e) {
    if (!canDropPdf || !hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }
  function handleDragOver(e) {
    if (!canDropPdf || !hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e) {
    if (!canDropPdf || !hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    attachFiles(e.dataTransfer.files);
  }

  return (
    <ThemeProvider theme={chatDarkTheme}>
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          height: 1,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid",
          borderColor: "divider",
          width: 1,
          backgroundColor: "background.default",
          color: "text.primary",
          position: "relative",
        }}
      >
        {dragOver && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              m: 1,
              border: "2px dashed",
              borderColor: "secondary.main",
              borderRadius: 2,
              backgroundColor: "rgba(23,23,23,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Typography variant="body2" color="secondary">
              {dropS}
            </Typography>
          </Box>
        )}
        <ChatHeader
          showRelayStatus={canDropPdf}
          onRelayStatusClick={() => setEditingKey((v) => !v)}
        />
        {canDropPdf && (
          <ChatRelayBar editing={editingKey} onEditingChange={setEditingKey} />
        )}
        <Stack
          ref={listRef}
          spacing={2.5}
          sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}
        >
          {messages.length === 0 && !isThinking ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ m: "auto", px: 2, textAlign: "center" }}
            >
              {emptyS}
            </Typography>
          ) : null}
          {messages.map((msg, i) =>
            msg.type === "vectorization" ? (
              <ChatMessageVectorization key={msg.id ?? i} message={msg} />
            ) : msg.type === "assistant" ? (
              <ChatMessageAssistant key={msg.id ?? i} message={msg} />
            ) : (
              <ChatMessage
                key={msg.id ?? i}
                role={msg.role}
                content={msg.content}
                images={msg.images}
              />
            )
          )}
          {isThinking && <ThinkingBubble />}
          <SectionManagedDataByAgent />
        </Stack>

        {openChat && canDropPdf && (
          <ChatAiTasks
            sendChatTurn={sendChatTurn}
            sending={sending}
            onStop={stopChatTurn}
            onPlay={playChatTurn}
            canResume={canResume}
          />
        )}
        {openChat && (
          <ChatInput
            sendChatTurn={sendChatTurn}
            sending={sending}
            canAttach={canDropPdf}
            pendingImages={pendingImages}
            attachError={attachError}
            onAttachFiles={attachFiles}
            onRemoveImage={removeImage}
            onImagesSent={() => setPendingImages([])}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
