import {
  SignedIn,
  UserButton,
  SignInButton,
  SignedOut,
} from "@clerk/clerk-react";

import {Box} from "@mui/material";
import ButtonSignIn from "./ButtonSignIn";

export function AuthButtons() {
  return (
    <Box
      sx={{
        p: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <ButtonSignIn />
      </SignedOut>
    </Box>
  );
}
