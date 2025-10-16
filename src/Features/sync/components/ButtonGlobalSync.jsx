import { IconButton } from "@mui/material";
import { Sync } from "@mui/icons-material";

export default function ButtonGlobalSync() {
  // handlers

  async function handleClick() {
    const response = await fetch("https://bimboxa.com/session", {
      method: "GET",
      credentials: "include", // REQUIRED to accept Set-Cookie cross-site
      headers: { Accept: "text/plain" },
    });
    console.log("response", response);
  }

  return (
    <IconButton onClick={handleClick}>
      <Sync />
    </IconButton>
  );
}
