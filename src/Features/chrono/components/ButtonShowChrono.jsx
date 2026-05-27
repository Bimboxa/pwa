import { useDispatch, useSelector } from "react-redux";

import { Box, Button } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import TimerOffIcon from "@mui/icons-material/TimerOff";

import { setChronoVisible } from "../chronoSlice";

export default function ButtonShowChrono() {
  const dispatch = useDispatch();

  // data

  const visible = useSelector((s) => s.chrono.visible);

  // handlers

  function handleClick() {
    dispatch(setChronoVisible(!visible));
  }

  // render

  return (
    <Box sx={{ px: 1, py: 0.5 }}>
      <Button
        onClick={handleClick}
        variant={visible ? "outlined" : "contained"}
        color="secondary"
        fullWidth
        startIcon={visible ? <TimerOffIcon /> : <TimerIcon />}
      >
        {visible ? "Masquer le chrono" : "Afficher le chrono"}
      </Button>
    </Box>
  );
}
