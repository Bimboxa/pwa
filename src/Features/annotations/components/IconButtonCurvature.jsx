import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useCurvature from "../hooks/useCurvature";

import { IconButton, Tooltip } from "@mui/material";

import IconCurvature from "Features/icons/IconCurvature";

export default function IconButtonCurvature({ annotations, accentColor }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Courbure";

  // data

  const curvature = useCurvature();

  // handlers

  async function handleClick() {
    try {
      const res = await curvature(annotations);
      if (res?.addedCount > 0) {
        dispatch(clearSelection());
      }
    } catch (e) {
      console.error("[curvature]", e);
    }
  }

  // render

  return (
    <Tooltip title={titleS}>
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          color: "text.disabled",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <IconCurvature fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
