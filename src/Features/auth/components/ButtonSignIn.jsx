import {useClerk} from "@clerk/clerk-react";

import {useNavigate} from "react-router-dom";

import {Button, Typography} from "@mui/material";

export default function ButtonSignIn() {
  const navigate = useNavigate();

  // strings

  const signInS = "Se connecter";

  // data

  const {redirectToSignIn} = useClerk();

  // handlers

  function handleClick() {
    try {
      // Redirect to Clerk-hosted Sign-In page
      //redirectToSignIn();
      navigate("/sign-in");
    } catch (err) {
      console.error("Error during sign-in:", err);
    }
  }
  return (
    <Button onClick={handleClick} color="secondary" variant="contained">
      <Typography variant="body2">{signInS}</Typography>
    </Button>
  );
}
