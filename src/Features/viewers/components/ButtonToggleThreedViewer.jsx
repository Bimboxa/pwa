import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import { Button, Typography } from "@mui/material";
import { ArrowRightAlt } from "@mui/icons-material";

export default function ButtonToggleThreedViewer() {
  const dispatch = useDispatch();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  const isThreed = selectedViewerKey === "THREED";

  const buttonLabel = isThreed ? "2D" : "3D";

  function handleClick() {
    dispatch(setSelectedViewerKey(isThreed ? "MAP" : "THREED"));
  }

  return (
    <Button
      startIcon={<ArrowRightAlt />}
      variant="outlined"
      color="secondary"
      size="small"
      onClick={handleClick}
      sx={{ borderRadius: "8px", border: theme => `1px solid ${theme.palette.secondary.main}` }}
    >
      <Typography variant="body2">
        {buttonLabel}
      </Typography>
    </Button>

  );
}
