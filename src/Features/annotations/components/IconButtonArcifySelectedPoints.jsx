import { useMemo } from "react";
import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import useArcifySelectedPoints from "../hooks/useArcifySelectedPoints";

import { IconButton, Tooltip } from "@mui/material";

import IconCurvature from "Features/icons/IconCurvature";

import getContiguousPointRun from "../utils/getContiguousPointRun";

export default function IconButtonArcifySelectedPoints({
  annotation,
  pointIds,
  accentColor,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Simplifier en arc";
  const disabledTitleS =
    "Sélectionnez au moins 3 points contigus d'un même contour";

  // data

  const arcify = useArcifySelectedPoints();

  // helpers

  const canArcify = useMemo(() => {
    if (!["POLYLINE", "POLYGON"].includes(annotation?.type)) return false;
    return getContiguousPointRun(annotation, pointIds).valid;
  }, [annotation, pointIds]);

  // handlers

  async function handleClick() {
    try {
      const res = await arcify({ annotation, pointIds });
      if (res?.changed) {
        dispatch(clearSelection());
      }
    } catch (e) {
      console.error("[arcifyPoints]", e);
    }
  }

  // render

  return (
    <Tooltip title={canArcify ? titleS : disabledTitleS}>
      <span>
        <IconButton
          size="small"
          onClick={handleClick}
          disabled={!canArcify}
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
      </span>
    </Tooltip>
  );
}
