import { Tooltip, IconButton } from "@mui/material";
import { Add } from "@mui/icons-material";

export default function ButtonCreateGeneric({
  label,
  onClick,
  variant = "icon",
}) {
  if (variant === "icon") {
    return (
      <Tooltip title={label}>
        <IconButton onClick={onClick}>
          <Add />
        </IconButton>
      </Tooltip>
    );
  }
}
