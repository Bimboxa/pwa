import { useRef, useState } from "react";

import PropTypes from "prop-types";

import { Box, TextField } from "@mui/material";

// Result field of the « Prompt IA » screens: the JSON the AI chat gave back,
// pasted as text or dropped as a file (.json / .txt).
export default function FieldPromptIaResultJson({
  value,
  onChange,
  placeholder,
  disabled = false,
}) {
  // strings

  const labelS = "Collez ou déposez ici le JSON renvoyé par l’IA";

  // state

  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  // helpers

  const hasFiles = (e) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  // handlers

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

  async function handleDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files ?? [])[0];
    if (disabled || !file) return;
    onChange(await file.text());
  }

  // render

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        width: 1,
        borderRadius: 1,
        ...(dragOver && {
          outline: "1.5px dashed",
          outlineColor: "secondary.main",
          bgcolor: "action.hover",
        }),
      }}
    >
      <TextField
        fullWidth
        multiline
        minRows={3}
        maxRows={6}
        label={labelS}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // keep the app's plain-letter hotkeys away from the text
        onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        disabled={disabled}
        slotProps={{ htmlInput: { spellCheck: false } }}
      />
    </Box>
  );
}

FieldPromptIaResultJson.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
};
