import { Box, Button, Typography } from "@mui/material";
import { AccountCircle } from "@mui/icons-material";

import useNotesAppSession from "../hooks/useNotesAppSession";
import { signOutNotesApp } from "../services/notesAppAuthService";

import SectionNotesAppLoginForm from "./SectionNotesAppLoginForm";

export default function SectionNotesAppConnection({ appName = "Krnet" }) {
  // strings

  const signOutS = "Se déconnecter";

  // data

  const { session } = useNotesAppSession();

  // handlers

  async function handleSignOut() {
    try {
      await signOutNotesApp();
    } catch (e) {
      console.log("[notesApp] sign out failed", e);
    }
  }

  // render

  if (!session) return <SectionNotesAppLoginForm appName={appName} />;

  return (
    <Box
      sx={{
        p: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <AccountCircle fontSize="small" color="action" />
        <Typography variant="body2" noWrap>
          {session.email}
        </Typography>
      </Box>
      <Button size="small" onClick={handleSignOut}>
        {signOutS}
      </Button>
    </Box>
  );
}
