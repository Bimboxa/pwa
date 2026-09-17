import { useDispatch, useSelector } from "react-redux";

import { setReasoningLevelId } from "../chatSlice";

import { MenuItem, Select, Typography } from "@mui/material";
import { KeyboardArrowDown as ArrowIcon } from "@mui/icons-material";

import { CHAT_COLORS, CHAT_FONT } from "../chatDarkTheme";

export const LEVEL_STORAGE_KEY = "bimboxa-chat-reasoningLevel";

// Level of reflection of the next turn / vectorization, as a quiet text
// control under the input. The list is loaded by ChatRelayBar.
export default function ChatLevelSelect() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Niveau de réflexion";

  // data

  const levels = useSelector((s) => s.chat.reasoningLevels);
  const levelId = useSelector((s) => s.chat.reasoningLevelId);
  const connected = useSelector(
    (s) => s.assistantRelay.connectionStatus === "connected"
  );

  // handlers

  function handleChange(e) {
    const id = e.target.value;
    dispatch(setReasoningLevelId(id));
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  // render

  if (!connected || !levels.length) return null;

  return (
    <Select
      size="small"
      variant="standard"
      disableUnderline
      value={levelId ?? ""}
      onChange={handleChange}
      IconComponent={ArrowIcon}
      inputProps={{ "aria-label": labelS }}
      renderValue={(id) => levels.find((l) => l.id === id)?.label ?? ""}
      sx={{
        fontSize: CHAT_FONT.button,
        color: "text.secondary",
        borderRadius: "8px",
        "&:hover": { color: "text.primary" },
        "& .MuiSelect-select": {
          py: "4px",
          pl: "8px",
          "&:focus": { backgroundColor: "transparent" },
        },
        "& .MuiSelect-icon": { color: "inherit", fontSize: 16, top: "auto" },
      }}
      MenuProps={{
        anchorOrigin: { vertical: "top", horizontal: "right" },
        transformOrigin: { vertical: "bottom", horizontal: "right" },
        PaperProps: {
          sx: {
            maxHeight: 320,
            mb: 0.5,
            backgroundColor: CHAT_COLORS.surfaceRaised,
            backgroundImage: "none",
            border: "1px solid",
            borderColor: CHAT_COLORS.borderStrong,
            borderRadius: "10px",
          },
        },
      }}
    >
      {levels.map((l) => (
        <MenuItem key={l.id} value={l.id}>
          {l.label}
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            {l.model}
            {l.reasoningEffort ? ` · ${l.reasoningEffort}` : ""}
          </Typography>
        </MenuItem>
      ))}
    </Select>
  );
}
