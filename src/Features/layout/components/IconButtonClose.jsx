import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function IconButtonClose({ onClose, sx, position }) {
  return (
    <IconButton
      onClick={onClose}
      sx={{
        ...sx,
        ...(position === "top-right" && {
          top: "8px",
          right: "8px",
          position: "absolute",
        }),
      }}
    >
      <CloseIcon />
    </IconButton>
  );
}
