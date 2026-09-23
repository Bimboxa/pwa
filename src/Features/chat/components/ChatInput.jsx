import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setBlockPlanImage } from "../chatSlice";

import useStartVectorization, {
  DEFAULT_VECTORIZATION_INSTRUCTION,
} from "../hooks/useStartVectorization";

import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputBase,
  Typography,
} from "@mui/material";
import { Add as AddIcon, ArrowUpward as SendIcon } from "@mui/icons-material";

import { CHAT_COLORS, CHAT_FONT } from "../chatDarkTheme";
import ChatImageThumbs from "./ChatImageThumbs";
import ChatLevelSelect from "./ChatLevelSelect";
import ChatBudgetIndicator from "./ChatBudgetIndicator";
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
  const blockImageS = "Ne pas envoyer le plan";
  const blockImageTitleS =
    "Coché : le modèle ne peut pas demander l'image du fond de plan affiché. Les images jointes sont toujours envoyées.";
  const placeholderS = "Un dessin, une liste… une image ou un PDF";

  // state

  const [input, setInput] = useState("");

  const isThinking = useSelector((s) => s.chat.isThinking);
  const dispatch = useDispatch();
  const blockPlanImage = useSelector((s) => s.chat.blockPlanImage);
  const {
    pendingPdf,
    hasActiveRun,
    clearPdf,
    setPageNumber,
    startVectorization,
  } = useStartVectorization();

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
  }, [sessionId]);

  const canSend = pendingPdf
    ? pendingPdf.status === "ready" && !hasActiveRun
    : Boolean(input.trim()) && !isThinking && !sending;

  const handleSend = async () => {
    if (pendingPdf) {
      if (pendingPdf.status !== "ready" || hasActiveRun) return;
      const { ok } = await startVectorization(input);
      if (ok) setInput("");
      return;
    }
    if (!input.trim() || isThinking || sending) return;
    // No PDF: a conversational turn (the model acts through the relay tools),
    // with the attached pictures if any.
    const text = input;
    const images = pendingImages;
    setInput("");
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
      {attachError ? (
        <Typography variant="caption" color="error">
          {attachError}
        </Typography>
      ) : null}

      {/* One rounded box: the text, and the send button in its corner.
          DOM order = keyboard order: text → "Envoyer" → attach → checkbox →
          level. */}
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
          placeholder={placeholderS}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
          {/* Ticked: the model cannot ask for the plan picture (typed messages
            only — a dropped PDF is a vectorization). */}
          {!pendingPdf ? (
            <FormControlLabel
              title={blockImageTitleS}
              sx={{ ml: "-2px", mr: 0, color: "text.secondary", minWidth: 0 }}
              control={
                <Checkbox
                  size="small"
                  color="default"
                  checked={blockPlanImage}
                  onChange={(e) =>
                    dispatch(setBlockPlanImage(e.target.checked))
                  }
                />
              }
              label={blockImageS}
              slotProps={{
                typography: { sx: { fontSize: CHAT_FONT.button, ml: 0.25 } },
              }}
            />
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
          <ChatBudgetIndicator />
        </Box>
      </Box>
    </Box>
  );
}
