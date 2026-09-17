import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setIsThinking } from "../chatSlice";

import { Stack, Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import ChatMessageAssistant from "./ChatMessageAssistant";
import ChatMessageVectorization from "./ChatMessageVectorization";
import ChatRelayBar from "./ChatRelayBar";
import useStartVectorization from "../hooks/useStartVectorization";
import useAssistantRelayConfig from "Features/assistantRelay/hooks/useAssistantRelayConfig";
import ThinkingBubble from "./ThinkingBubble";
import ChatHeader from "./ChatHeader";
import SectionManagedDataByAgent from "./SectionManagedDataByAgent";

export default function PanelChat() {
  const dispatch = useDispatch();

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
  const { attachPdf } = useStartVectorization();
  const [dragOver, setDragOver] = useState(false);
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
    attachPdf(e.dataTransfer.files?.[0]);
  }

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        height: 1,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #ccc",
        width: 1,
        backgroundColor: "#f9f9f9",
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
            backgroundColor: "rgba(255,255,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Typography variant="body1" color="secondary">
            Déposer un PDF à vectoriser
          </Typography>
        </Box>
      )}
      <ChatHeader />
      {canDropPdf && <ChatRelayBar />}
      <Stack spacing={2} sx={{ flex: 1, overflowY: "auto", p: 1 }}>
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
            />
          )
        )}
        {isThinking && <ThinkingBubble />}
        <SectionManagedDataByAgent />
      </Stack>

      {openChat && <ChatInput />}
    </Box>
  );
}
