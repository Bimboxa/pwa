import { useSelector, useDispatch } from "react-redux";

import { setOpenLeftPanel } from "Features/leftPanel/leftPanelSlice";

import { Box, IconButton } from "@mui/material";
import {
  Fullscreen,
  FullscreenExit as FullScreenExit,
} from "@mui/icons-material";

import ButtonGeneric from "./ButtonGeneric";
import { setIsFullScreen } from "../layoutSlice";

export default function ButtonFullScreen() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Mode plein écran";

  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

  // handlers

  function handleClick() {
    dispatch(setIsFullScreen(!isFullScreen));
  }

  // render

  if (!isFullScreen)
    return (
      <ButtonGeneric
        startIcon={<Fullscreen />}
        label={labelS}
        onClick={handleClick}
        variant="contained"
      />
    );

  if (isFullScreen) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          bgcolor: "primary.main",
          color: "white",
        }}
      >
        <IconButton onClick={handleClick} color="inherit">
          <FullScreenExit />
        </IconButton>
      </Box>
    );
  }
}
