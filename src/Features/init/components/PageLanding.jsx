import {useState, useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";

import {setOpenLandingPage} from "Features/init/initSlice";
import {setToaster} from "Features/layout/layoutSlice";

import {Box, Typography, Button} from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import LogoBimboxa from "Features/layout/components/LogoBimboxa";
import LogoAnimated from "Features/layout/components/LogoAnimated";

export default function PageLanding() {
  const dispatch = useDispatch();

  const [fadeOut, setFadeOut] = useState(false);
  const [visible, setVisible] = useState(true);

  const [open, setOpen] = useState(true);

  // data

  const version = useSelector((s) => s.appConfig.appVersion);

  // effect - trigger close landing page

  useEffect(() => {
    if (version) setOpen(false);
  }, []);

  // effect - fade out effect

  useEffect(() => {
    if (!open) {
      // Step 1: trigger fade out after delay
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 100); // wait 1s before starting fade

      // Step 2: unmount after fade duration (1s)
      const unmountTimer = setTimeout(() => {
        setVisible(false);
        dispatch(setOpenLandingPage(false));
      }, 1000); // total 2s = 1s wait + 1s fade

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [open]);

  if (!visible) return null;

  // handlers

  function handleVersionClick(e) {
    e.stopPropagation();
    console.log("version click");

    dispatch(setToaster({message: "Vérification mise à jour ..."}));
  }

  return (
    <Box
      onClick={() => setOpen(false)}
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
          <LogoAnimated />
          <Button sx={{mt: 2}} onClick={handleVersionClick}>
            <Typography>{version}</Typography>
          </Button>
        </BoxCenter>
      </Box>
    </Box>
  );
}
