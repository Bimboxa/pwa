import { Box } from "@mui/material";

import { SignIn } from "@clerk/clerk-react";

import PageSignInVariantPhoneNumber from "./PageSignInVariantPhoneNumber";

export default function PageSignIn() {
  // data

  const signInVariant = "PHONE_NUMBER";

  if (signInVariant === "PHONE_NUMBER") {
    console.log("PHONE_NUMBER");
    return <PageSignInVariantPhoneNumber />;
  }

  return (
    <Box
      sx={{
        width: 1,
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        //sbgcolor: "primary.main",
      }}
    >
      <SignIn />
    </Box>
  );
}
