import { useRef, useState } from "react";

import PropTypes from "prop-types";

import { Box, Button, TextField, Typography } from "@mui/material";

import ListPromptIaFiles from "./ListPromptIaFiles";

const ACCEPT = ".zip,.json,.txt,application/zip,application/json,text/plain";

// Result field of the « Prompt IA » screens: the JSON the AI chat gave back,
// pasted as text or dropped as a file (.json / .txt).
//
// With `onFile`, the field also takes the result as a FILE — a `.json` /
// `.txt`, or the zip (`resultat.json` + the files of the base maps the model
// created), dropped or picked: the caller reads it and gives it back as
// `file`, shown as a row instead of being poured into the text field.
export default function FieldPromptIaResultJson({
  value,
  onChange,
  file,
  onFile,
  placeholder,
  disabled = false,
}) {
  // strings

  const labelS = onFile
    ? "Collez ici le JSON renvoyé par l’IA"
    : "Collez ou déposez ici le JSON renvoyé par l’IA";
  const pickS = "Choisir un fichier";
  const hintS = "ou déposez le zip (ou le .json) renvoyé par l’IA";

  // state

  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);

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
    const dropped = Array.from(e.dataTransfer.files ?? [])[0];
    if (disabled || !dropped) return;
    if (onFile) onFile(dropped);
    else onChange(await dropped.text());
  }

  function handlePicked(e) {
    const picked = Array.from(e.currentTarget.files ?? [])[0];
    // same file picked twice in a row must trigger a change again
    e.currentTarget.value = "";
    if (picked) onFile(picked);
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
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderRadius: 1,
        ...(dragOver && {
          outline: "1.5px dashed",
          outlineColor: "secondary.main",
          bgcolor: "action.hover",
        }),
      }}
    >
      {file ? (
        <ListPromptIaFiles
          items={[{ key: "result", label: file.name, sizeBytes: file.size }]}
          onRemove={() => onFile(null)}
          disabled={disabled}
        />
      ) : (
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
      )}
      {Boolean(onFile) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={ACCEPT}
            onChange={handlePicked}
          />
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {pickS}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {hintS}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

FieldPromptIaResultJson.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  file: PropTypes.object,
  onFile: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
};
