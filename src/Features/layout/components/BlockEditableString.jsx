import { useState } from "react";
import { Typography, InputBase } from "@mui/material";

export default function BlockEditableString({ value, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleClick = () => {
    setIsEditing(true);
    setEditValue(value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange({ target: { value: editValue } });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  if (isEditing) {
    return (
      <InputBase
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        sx={{
          fontSize: "inherit",
          fontFamily: "inherit",
          fontWeight: "inherit",
          color: "inherit",
        }}
      />
    );
  }

  return (
    <Typography
      onClick={handleClick}
      sx={{
        cursor: "text",
        "&:hover": {
          backgroundColor: "rgba(0, 0, 0, 0.04)",
        },
      }}
    >
      {value ?? "-?-"}
    </Typography>
  );
}
