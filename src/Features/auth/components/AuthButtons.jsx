import useNetworkStatus from "../hooks/useNetworkStatus";
import useToken from "../hooks/useToken";

import { SignedIn, UserButton, SignedOut, useAuth } from "@clerk/clerk-react";

import { Box } from "@mui/material";
import ButtonSignIn from "./ButtonSignIn";
import AuthButtonOffline from "./AuthButtonOffline";

import CredentialsIcon from "Features/servicesCredentials/components/CredentialsIcon";
import PageServicesCredentials from "Features/servicesCredentials/components/PageServicesCredentials";

export function AuthButtons() {
  // data

  const isOnline = useNetworkStatus();
  const token = useToken();

  // debug - handler

  const handleDebug = () => {
    console.log("debug_1705", token);
  };

  if (!isOnline) {
    return <AuthButtonOffline />;
  }

  return (
    <Box
      key={`auth-${isOnline}`}
      sx={{
        p: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={handleDebug}
    >
      <SignedIn>
        <UserButton>
          <UserButton.UserProfilePage
            label="Secrets"
            url="custom-services-credentials"
            labelIcon={<CredentialsIcon />}
          >
            <PageServicesCredentials />
          </UserButton.UserProfilePage>
        </UserButton>
      </SignedIn>
      <SignedOut>
        <ButtonSignIn />
      </SignedOut>
    </Box>
  );
}
