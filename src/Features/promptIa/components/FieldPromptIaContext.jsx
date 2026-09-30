import { useRef, useState } from "react";

import PropTypes from "prop-types";

import useSpeechDictation from "Features/chat/hooks/useSpeechDictation";

import {
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import ChatMicButton from "Features/chat/components/ChatMicButton";

// Context field of the « Prompt IA » screens, modelled on the chat input: a
// multiline text with a microphone (dictation) and a « + » (attachments).
// The whole box is a drop target, and a file pasted in the text is an
// attachment. `onDrop` receives the raw DataTransfer (dropped folders);
// without it the dropped files go to `onFiles`. `children` is the list of the
// attached files.
export default function FieldPromptIaContext({
  value,
  onChange,
  placeholder,
  maxLength,
  accept,
  onFiles,
  onDrop,
  extraAttachActions = [],
  hint,
  loading = false,
  disabled = false,
  minRows = 3,
  children,
}) {
  // strings

  const attachS = "Ajouter des fichiers";
  const fromComputerS = "Depuis l’ordinateur";
  const dictateS = "Dicter le texte";
  const listeningPlaceholderS = "Je vous écoute…";

  // state

  const [dragOver, setDragOver] = useState(false);
  const [attachAnchor, setAttachAnchor] = useState(null);
  const dragDepth = useRef(0);
  const fileInputRef = useRef(null);

  // helpers

  const clamp = (text) => (maxLength > 0 ? text.slice(0, maxLength) : text);

  const dictation = useSpeechDictation({
    onText: (text) => onChange(clamp(text)),
  });
  const {
    supported: micSupported,
    listening,
    error: dictationError,
    rebase: rebaseDictation,
  } = dictation;

  const hasFiles = (e) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  // handlers

  function handleInputChange(e) {
    const text = clamp(e.target.value);
    onChange(text);
    // Typed while listening: the next transcript builds on the typed text.
    if (listening) rebaseDictation(text);
  }

  function handleKeyDown(e) {
    // keep the app's plain-letter hotkeys away from the text (Escape still
    // closes the dialog)
    if (e.key !== "Escape") e.stopPropagation();
  }

  function handlePaste(e) {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (disabled || !files.length) return;
    e.preventDefault();
    onFiles(files);
  }

  function handleFilesPicked(e) {
    const files = Array.from(e.currentTarget.files ?? []);
    // same file picked twice in a row must trigger a change again
    e.currentTarget.value = "";
    if (files.length) onFiles(files);
  }

  function handleAttachClick(e) {
    if (extraAttachActions.length > 0) setAttachAnchor(e.currentTarget);
    else fileInputRef.current?.click();
  }

  function handleDragEnter(e) {
    if (disabled || !hasFiles(e)) return;
    dragDepth.current += 1;
    setDragOver(true);
  }

  function handleDragLeave(e) {
    if (disabled || !hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  function handleDragOver(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    if (disabled) return;
    if (onDrop) onDrop(e.dataTransfer);
    else onFiles(Array.from(e.dataTransfer.files ?? []));
  }

  // render

  return (
    <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          width: 1,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          px: 1.5,
          pt: 1,
          pb: 0.5,
          border: dragOver ? "1.5px dashed" : "1px solid",
          borderColor: dragOver ? "secondary.main" : "divider",
          borderRadius: "12px",
          bgcolor: dragOver ? "action.hover" : "background.paper",
          transition: "border-color 120ms",
          "&:focus-within": {
            borderColor: dragOver ? "secondary.main" : "text.secondary",
          },
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {children}

        <InputBase
          multiline
          minRows={minRows}
          maxRows={8}
          fullWidth
          placeholder={listening ? listeningPlaceholderS : placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={handlePaste}
          disabled={disabled}
          inputProps={{ "aria-label": placeholder }}
          sx={{ py: "3px", fontSize: 14, lineHeight: 1.5 }}
        />

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            minHeight: 28,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept={accept}
            onChange={handleFilesPicked}
          />
          <IconButton
            size="small"
            aria-label={attachS}
            title={attachS}
            onClick={handleAttachClick}
            disabled={disabled || loading}
            sx={{
              ml: "-4px",
              width: 26,
              height: 26,
              borderRadius: "8px",
              color: "text.secondary",
              "&:hover": { color: "text.primary" },
            }}
          >
            {loading ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <AddIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
          <Menu
            anchorEl={attachAnchor}
            open={Boolean(attachAnchor)}
            onClose={() => setAttachAnchor(null)}
          >
            <MenuItem
              dense
              onClick={() => {
                setAttachAnchor(null);
                fileInputRef.current?.click();
              }}
            >
              {fromComputerS}
            </MenuItem>
            {extraAttachActions.map((action) => (
              <MenuItem
                key={action.label}
                dense
                onClick={() => {
                  setAttachAnchor(null);
                  action.onClick();
                }}
              >
                {action.label}
              </MenuItem>
            ))}
          </Menu>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ flex: 1, minWidth: 0 }}
          >
            {hint}
          </Typography>
          <ChatMicButton
            supported={micSupported}
            listening={listening}
            onToggle={() => dictation.toggle(value ?? "")}
            startLabel={dictateS}
          />
        </Box>
      </Box>
      {Boolean(dictationError) && (
        <Typography variant="caption" color="error">
          {dictationError}
        </Typography>
      )}
    </Box>
  );
}

FieldPromptIaContext.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  maxLength: PropTypes.number,
  accept: PropTypes.string,
  onFiles: PropTypes.func.isRequired,
  onDrop: PropTypes.func,
  extraAttachActions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
    })
  ),
  hint: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  minRows: PropTypes.number,
  children: PropTypes.node,
};
