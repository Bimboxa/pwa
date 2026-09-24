import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import useStartVectorization, {
  DEFAULT_VECTORIZATION_INSTRUCTION,
} from "../hooks/useStartVectorization";
import useSpeechDictation from "../hooks/useSpeechDictation";

import { Box, IconButton, InputBase, Typography } from "@mui/material";
import { Add as AddIcon, ArrowUpward as SendIcon } from "@mui/icons-material";

import { CHAT_COLORS, CHAT_FONT } from "../chatDarkTheme";
import ChatImageThumbs from "./ChatImageThumbs";
import ChatLevelSelect from "./ChatLevelSelect";
import ChatBudgetIndicator from "./ChatBudgetIndicator";
import ChatMicButton from "./ChatMicButton";
import ChatPendingPdf from "./ChatPendingPdf";

const ATTACH_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

export default function ChatInput({
  sendChatTurn,
  sending,
  canAttach,
  pendingImages = [],
  attachError,
  onAttachFiles,
  onRemoveImage,
  onImagesSent,
}) {
  // strings

  const sendS = "Envoyer";
  const attachS = "Joindre une image ou un PDF";
  const placeholderS = "Un dessin, une liste… une image ou un PDF";
  const listeningPlaceholderS = "Je vous écoute…";

  // state

  const [input, setInput] = useState("");

  const isThinking = useSelector((s) => s.chat.isThinking);
  const {
    pendingPdf,
    hasActiveRun,
    clearPdf,
    setPageNumber,
    startVectorization,
  } = useStartVectorization();

  // Dictation writes straight into the draft; it stops once the message is
  // sent (one cycle per message).
  const dictation = useSpeechDictation({ onText: setInput });
  const {
    supported: micSupported,
    listening,
    error: dictationError,
    stop: stopDictation,
    rebase: rebaseDictation,
  } = dictation;

  // A PDF was dropped: propose the default instruction (still editable).
  const pdfStatus = pendingPdf?.status;
  useEffect(() => {
    if (pdfStatus === "uploading") {
      setInput((current) => current || DEFAULT_VECTORIZATION_INSTRUCTION);
    }
  }, [pdfStatus]);

  // "Nouvelle session" also empties the draft.
  const sessionId = useSelector((s) => s.chat.sessionId);
  useEffect(() => {
    setInput("");
    stopDictation();
  }, [sessionId, stopDictation]);

  const canSend = pendingPdf
    ? pendingPdf.status === "ready" && !hasActiveRun
    : Boolean(input.trim()) && !isThinking && !sending;

  const handleSend = async () => {
    if (pendingPdf) {
      if (pendingPdf.status !== "ready" || hasActiveRun) return;
      const { ok } = await startVectorization(input);
      if (ok) {
        setInput("");
        stopDictation();
      }
      return;
    }
    if (!input.trim() || isThinking || sending) return;
    // No PDF: a conversational turn (the model acts through the relay tools),
    // with the attached pictures if any.
    const text = input;
    const images = pendingImages;
    setInput("");
    // Stop before awaiting: a late result must not refill the emptied draft.
    stopDictation();
    onImagesSent?.();
    await sendChatTurn(text, { images });
  };

  const fileInputRef = useRef(null);

  function handleFilesPicked(e) {
    onAttachFiles?.(e.target.files);
    // Same file again later must fire `change` again.
    e.target.value = "";
  }

  // A screenshot pasted in the text is an attachment.
  function handlePaste(e) {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!canAttach || !files.length) return;
    e.preventDefault();
    onAttachFiles?.(files);
  }

  function handleInputChange(e) {
    const value = e.target.value;
    setInput(value);
    // Typed while listening: the next transcript builds on the typed text.
    if (listening) rebaseDictation(value);
  }

  function handleMicToggle() {
    dictation.toggle(input);
  }

  function handleKeyDown(e) {
    // The map editor listens to the keyboard: typing here is not a shortcut.
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Box
      sx={{
        width: 1,
        px: 1.5,
        pt: 1,
        pb: 0.75,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <ChatPendingPdf
        pendingPdf={pendingPdf}
        onPageChange={setPageNumber}
        onClear={clearPdf}
      />
      <ChatImageThumbs images={pendingImages} onRemove={onRemoveImage} />
      {attachError || dictationError ? (
        <Typography variant="caption" color="error">
          {attachError || dictationError}
        </Typography>
      ) : null}

      {/* One rounded box: the text, and the send button in its corner.
          DOM order = keyboard order: text → "Envoyer" → attach →
          level → micro → budget. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 0.5,
          pl: 1.5,
          pr: 0.75,
          py: 0.75,
          backgroundColor: CHAT_COLORS.surface,
          border: "1px solid",
          borderColor: CHAT_COLORS.borderStrong,
          borderRadius: "12px",
          transition: "border-color 120ms",
          "&:focus-within": { borderColor: "#5a5a5a" },
        }}
      >
        <InputBase
          multiline
          minRows={1}
          maxRows={8}
          fullWidth
          placeholder={listening ? listeningPlaceholderS : placeholderS}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={handlePaste}
          inputProps={{ "aria-label": placeholderS }}
          sx={{
            py: "3px",
            fontSize: CHAT_FONT.message,
            lineHeight: 1.5,
            color: "text.primary",
            "& textarea::placeholder": {
              color: CHAT_COLORS.textSecondary,
              opacity: 1,
            },
          }}
        />
        <IconButton
          size="small"
          aria-label={sendS}
          title={sendS}
          onClick={handleSend}
          disabled={!canSend}
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: "8px",
            color: "#fff",
            backgroundColor: "secondary.main",
            "&:hover": { backgroundColor: "secondary.dark" },
            "&.Mui-disabled": {
              color: CHAT_COLORS.textSecondary,
              backgroundColor: "transparent",
            },
          }}
        >
          <SendIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          minHeight: 28,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          {canAttach ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept={ATTACH_ACCEPT}
                onChange={handleFilesPicked}
              />
              <IconButton
                size="small"
                aria-label={attachS}
                title={attachS}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  ml: "-4px",
                  mr: 0.5,
                  width: 26,
                  height: 26,
                  borderRadius: "8px",
                  color: "text.secondary",
                  "&:hover": { color: "text.primary" },
                }}
              >
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          ) : null}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <ChatLevelSelect />
          <ChatMicButton
            supported={micSupported}
            listening={listening}
            onToggle={handleMicToggle}
          />
          <ChatBudgetIndicator />
        </Box>
      </Box>
    </Box>
  );
}
