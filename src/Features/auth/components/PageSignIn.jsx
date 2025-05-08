import {Box} from "@mui/material";

import {SignIn} from "@clerk/clerk-react";

export default function PageSignIn() {
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
