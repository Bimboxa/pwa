import { IconButton } from "@mui/material";
import { CopyAll as CopyIcon } from "@mui/icons-material";
import ButtonGeneric from "./ButtonGeneric";

export default function IconButtonCopyString({
  string,
  variant = "icon",
  label = "Copier",
}) {
  // strings

  async function handleCopyClick() {
    await navigator.clipboard.writeText(string);
  }

  if (variant === "icon") {
    return (
      <IconButton onClick={handleCopyClick}>
        <CopyIcon />
      </IconButton>
    );
  }

  if (variant === "button") {
    return (
      <ButtonGeneric
        startIcon={<CopyIcon />}
        label={label}
        onClick={handleCopyClick}
        variant="contained"
        size="small"
      />
    );
  }
}
