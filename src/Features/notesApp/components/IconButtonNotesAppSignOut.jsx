import { IconButton, Tooltip } from "@mui/material";
import { Logout } from "@mui/icons-material";

import { signOutNotesApp } from "../services/notesAppAuthService";

export default function IconButtonNotesAppSignOut() {
  // strings

  const signOutS = "Se déconnecter";

  // handlers

  async function handleSignOut() {
    try {
      await signOutNotesApp();
    } catch (e) {
      console.log("[notesApp] sign out failed", e);
    }
  }

  // render

  return (
    <Tooltip title={signOutS}>
      <IconButton onClick={handleSignOut}>
        <Logout />
      </IconButton>
    </Tooltip>
  );
}
