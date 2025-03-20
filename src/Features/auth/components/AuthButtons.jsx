import {
  SignedIn,
  UserButton,
  SignInButton,
  SignedOut,
} from "@clerk/clerk-react";

import {Box} from "@mui/material";
import ButtonSignIn from "./ButtonSignIn";
import CredentialsIcon from "Features/servicesCredentials/components/CredentialsIcon";
import PageServicesCredentials from "Features/servicesCredentials/components/PageServicesCredentials";

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
