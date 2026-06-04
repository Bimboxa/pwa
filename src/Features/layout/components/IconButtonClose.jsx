import { IconButton, Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function IconButtonClose({ onClose, sx, position, disabled }) {
  return (
    <Box
      sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      <IconButton
        onClick={onClose}
        disabled={disabled}
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
    </Box>
  );
}
