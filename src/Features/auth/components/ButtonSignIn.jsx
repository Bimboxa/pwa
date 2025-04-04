import {useClerk} from "@clerk/clerk-react";

import {Button} from "@mui/material";

export default function ButtonSignIn() {
  // strings

  const signInS = "Se connecter";

  // data

  const {redirectToSignIn} = useClerk();

  // handlers

  function handleClick() {
    try {
      // Redirect to Clerk-hosted Sign-In page
      redirectToSignIn();
    } catch (err) {
      console.error("Error during sign-in:", err);
    }
  }
  return (
    <Button onClick={handleClick} color="secondary" variant="contained">
      {signInS}
    </Button>
  );
}
