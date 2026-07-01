import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useArcifyAnnotation from "../hooks/useArcifyAnnotation";

import { IconButton, Tooltip } from "@mui/material";

import IconCurvature from "Features/icons/IconCurvature";

export default function IconButtonArcifyAnnotation({
  annotation,
  accentColor,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Détecter les arcs";

  // data

  const arcify = useArcifyAnnotation();

  // handlers

  async function handleClick() {
    try {
      const res = await arcify(annotation);
      if (res?.changed) {
        dispatch(clearSelection());
      }
    } catch (e) {
      console.error("[arcify]", e);
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
