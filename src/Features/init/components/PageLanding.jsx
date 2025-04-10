import {useState, useEffect} from "react";

import {Box, Typography} from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import LogoBimboxa from "Features/layout/components/LogoBimboxa";

export default function PageLanding() {
  const [fadeOut, setFadeOut] = useState(false);
  const [visible, setVisible] = useState(true);

  const version = "v1.1";

  useEffect(() => {
    // Step 1: trigger fade out after delay
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1000); // wait 1s before starting fade

    // Step 2: unmount after fade duration (1s)
    const unmountTimer = setTimeout(() => {
      setVisible(false);
    }, 2000); // total 2s = 1s wait + 1s fade

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        backgroundColor: "black",
        zIndex: 1300,
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 1s ease-in-out",
      }}
    >
      <Box
        sx={{
          width: 1,
          height: 1,
          display: "flex",
          top: 0,
          left: 0,
          position: "absolute",
          bgcolor: "background.default",
        }}
      >
        <BoxCenter sx={{display: "flex", flexDirection: "column"}}>
          <LogoBimboxa />
          <Typography sx={{mt: 2}}>{version}</Typography>
        </BoxCenter>
      </Box>
    </Box>
  );
}
