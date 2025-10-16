import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import { SignIn } from "@clerk/clerk-react";

import PageSignInVariantPhoneNumber from "./PageSignInVariantPhoneNumber";

export default function PageSignIn() {
  // data

  //const signInVariant = "PHONE_NUMBER";
  const appConfig = useAppConfig();
  const signInVariant = appConfig?.auth?.service;

  if (signInVariant === "PHONE_NUMBER") {
    return <PageSignInVariantPhoneNumber />;
  }

  if (signInVariant === "CLERK")
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
