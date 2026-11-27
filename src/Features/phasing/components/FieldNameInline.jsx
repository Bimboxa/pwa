import { useRef, useState } from "react";

import { Box, InputBase, Tooltip } from "@mui/material";

const MAX_WIDTH = 220;

// Name renamed in place in the phases strip: plain text, a click turns it
// into a text input (caret), `onCommit(name)` is called when the input loses
// the focus (Enter = same, Escape = cancel). An empty or unchanged name is
// ignored. `sx`: typography of the text (the input inherits it).
export default function FieldNameInline({ value, onCommit, tooltip, sx }) {
  // state

  // null = not editing
  const [draft, setDraft] = useState(null);
  const cancelledRef = useRef(false);

  // handlers

  function handleBlur() {
    const name = (draft ?? "").trim();
    const cancelled = cancelledRef.current;
    cancelledRef.current = false;
    setDraft(null);
    if (cancelled || !name || name === value) return;
    onCommit(name);
  }

  function handleKeyDown(e) {
    // the editors' hotkeys must not fire while typing
    e.stopPropagation();
    if (e.key === "Escape") cancelledRef.current = true;
    if (e.key === "Enter" || e.key === "Escape") e.target.blur();
  }

  // render — the text and the input share ONE grid cell sized by the text
  // (hidden while editing, it then mirrors the draft): entering the edit
  // mode changes neither the width nor the height, nothing moves in the strip

  const isEditing = draft != null;

  return (
    <Box
      sx={{
        display: "inline-grid",
        alignItems: "center",
        minWidth: 0,
        maxWidth: MAX_WIDTH,
        flexShrink: 1,
        fontSize: 12,
        lineHeight: 1.4,
        "& > *": { gridArea: "1 / 1", minWidth: 0 },
        ...sx,
      }}
    >
      <Tooltip title={isEditing ? "" : (tooltip ?? "")}>
        <Box
          component="span"
          onClick={() => setDraft(value ?? "")}
          sx={{
            // room for the caret after the last character
            pr: "2px",
            minWidth: 24,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "pre",
            cursor: "text",
            visibility: isEditing ? "hidden" : "visible",
          }}
        >
          {isEditing ? draft || " " : value}
        </Box>
      </Tooltip>
      {isEditing && (
        <InputBase
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          sx={{
            width: 1,
            font: "inherit",
            color: "inherit",
            "& input": { p: 0, height: "auto", font: "inherit" },
          }}
        />
      )}
    </Box>
  );
}
