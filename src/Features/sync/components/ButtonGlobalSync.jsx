import { IconButton } from "@mui/material";
import { Sync } from "@mui/icons-material";

export default function ButtonGlobalSync() {
  // handlers

  async function handleClick() {
    console.log("click");
  }

  return (
    <IconButton onClick={handleClick}>
      <Sync />
    </IconButton>
  );
}
