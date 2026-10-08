import { useDispatch, useSelector } from "react-redux";

import { setIsFullScreen } from "../layoutSlice";

import { Button } from "@mui/material";
import { Fullscreen, FullscreenExit } from "@mui/icons-material";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

// Top-right toggle of the editors' full screen mode: the top bar, the modules
// band, the left dock and the bottom bar go away, only the displayed editor
// and the right tools band stay (see LayoutDesktop); the browser full screen
// follows (useBrowserFullScreenSync). Off: floating icon button with the look
// of the row (ButtonBaseMapsGrid). On: a labelled secondary contained button,
// the obvious way out of the mode. Mounted in the three mirrored rows (2D
// editor, 3D editor, base maps grid).
export default function ButtonFullScreen() {
  const dispatch = useDispatch();

  // strings

  const enterS = "Plein écran";
  const exitS = "Quitter le mode plein écran";

  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

  // handlers

  function handleClick() {
    dispatch(setIsFullScreen(!isFullScreen));
  }

  // render

  if (isFullScreen) {
    return (
      <Button
        size="small"
        variant="contained"
        color="secondary"
        startIcon={<FullscreenExit />}
        onClick={handleClick}
        sx={{ whiteSpace: "nowrap", borderRadius: "10px" }}
      >
        {exitS}
      </Button>
    );
  }

  return (
    <ButtonBaseMapsGrid
      title={enterS}
      icon={<Fullscreen fontSize="small" />}
      onClick={handleClick}
    />
  );
}
