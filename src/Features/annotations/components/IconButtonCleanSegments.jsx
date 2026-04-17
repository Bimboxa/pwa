import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useCleanSegments from "../hooks/useCleanSegments";

import { IconButton, Tooltip } from "@mui/material";

import IconCleanSegments from "Features/icons/IconCleanSegments";

export default function IconButtonCleanSegments({ annotations, accentColor }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Nettoyer les segments";

  // data

  const cleanSegments = useCleanSegments();

  // handlers

  async function handleClick() {
    try {
      await cleanSegments(annotations);
      dispatch(clearSelection());
    } catch (e) {
      console.error("[cleanSegments]", e);
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
        <IconCleanSegments fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
