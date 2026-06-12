import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setModelStatus, resetConversation } from "../localLlmSlice";

import { Box, Stack, Typography, IconButton } from "@mui/material";
import { Refresh } from "@mui/icons-material";

import ChatMessage from "Features/chat/components/ChatMessage";
import ThinkingBubble from "Features/chat/components/ThinkingBubble";
import SectionLocalLlmStatus from "./SectionLocalLlmStatus";
import LocalLlmInput from "./LocalLlmInput";

import {
  isSupported,
  getAvailability,
  resetSession,
} from "../services/geminiNanoService";

export default function PanelLocalLlm() {
  const dispatch = useDispatch();

  // strings

  const titleS = "IA locale";
  const resetS = "Nouvelle conversation";

  // data

  const messages = useSelector((s) => s.localLlm.messages);
  const modelStatus = useSelector((s) => s.localLlm.modelStatus);
  const isStreaming = useSelector((s) => s.localLlm.isStreaming);

  // helpers

  const visibleMessages = messages.filter((msg) => msg.content);

  // the model is "thinking" while a turn is pending and no answer text has
  // been displayed yet (routing + args generation phases)
  const lastMessage = messages[messages.length - 1];
  const isThinking =
    isStreaming && lastMessage?.role === "assistant" && !lastMessage.content;

  // refs

  const lastMessageRef = useRef(null);

  // effect - scroll to the start of the latest message when a new bubble appears

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [visibleMessages.length]);

  // effect - check model availability on mount

  useEffect(() => {
    if (!isSupported()) {
      dispatch(setModelStatus("unsupported"));
      return;
    }
    getAvailability()
      .then((availability) => dispatch(setModelStatus(availability)))
      .catch(() => dispatch(setModelStatus("unavailable")));
  }, []);

  // handlers

  function handleReset() {
    resetSession();
    dispatch(resetConversation());
    dispatch(setModelStatus("checking"));
    getAvailability()
      .then((availability) => dispatch(setModelStatus(availability)))
      .catch(() => dispatch(setModelStatus("unavailable")));
  }

  // render

  return (
    <Box
      sx={{
        height: 1,
        width: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f9f9f9",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
          borderBottom: "1px solid #ccc",
        }}
      >
        <Typography variant="subtitle2">{titleS}</Typography>
        <IconButton size="small" onClick={handleReset} title={resetS}>
          <Refresh fontSize="small" />
        </IconButton>
      </Box>

      <SectionLocalLlmStatus />

      <Stack spacing={2} sx={{ flex: 1, overflowY: "auto", p: 1 }}>
        {visibleMessages.map((msg, i) => (
          <Box
            key={i}
            ref={i === visibleMessages.length - 1 ? lastMessageRef : null}
          >
            <ChatMessage role={msg.role} content={msg.content} />
          </Box>
        ))}
        {isThinking && <ThinkingBubble />}
      </Stack>

      {modelStatus === "available" && <LocalLlmInput />}
    </Box>
  );
}
