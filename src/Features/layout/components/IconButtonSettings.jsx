import { IconButton } from "@mui/material";
import { Settings } from "@mui/icons-material";

export default function IconButtonSettings({ onClick, sx }) {
  return (
    <IconButton
      onClick={onClick}
      sx={{
        ...sx,
      }}
    >
      <Settings />
    </IconButton>
  );
}
