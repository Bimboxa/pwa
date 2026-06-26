import { useSelector, useDispatch } from "react-redux";

import {
  setClippingPlanEnabled,
  setClippingPlan,
} from "Features/mapEditor/mapEditorSlice";
import { setClippingPlaneEnabled as setThreedClippingPlaneEnabled } from "Features/threedEditor/threedEditorSlice";

import {
  Paper,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";

import { IconCutPlaneSide } from "Features/threedEditor/components/iconsClippingPlane";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// Toggle in the bottom toolbar (left of OrthoSnap). When ON, a free draggable
// segment appears on the baseMap (NodeClippingPlanStatic): it is the
// intersection of a vertical cutting plane with the top view. The same plane is
// mirrored to the 3D viewer's ClippingManager.
export default function SelectorClippingPlan() {
  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();

  const clippingPlanEnabled = useSelector(
    (s) => s.mapEditor.clippingPlanEnabled
  );
  const clippingPlan = useSelector((s) => s.mapEditor.clippingPlan);

  // handlers

  function handleToggle() {
    const next = !clippingPlanEnabled;
    if (next) {
      // (Re)initialize a default centered horizontal segment when there is no
      // segment yet, or when it belongs to another baseMap.
      if (!clippingPlan?.pointA || clippingPlan?.baseMapId !== baseMap?.id) {
        dispatch(
          setClippingPlan({
            pointA: { x: 0.15, y: 0.5 },
            pointB: { x: 0.85, y: 0.5 },
            sign: 1,
            baseMapId: baseMap?.id ?? null,
          })
        );
      }
    }
    dispatch(setClippingPlanEnabled(next));
    dispatch(setThreedClippingPlaneEnabled(next));
  }

  // render

  return (
    <Paper
      sx={{
        borderRadius: "8px",
        transition: "all 0.2s ease",
        bgcolor: "background.paper",
        border: "none",
        display: "inline-flex",
        overflow: "hidden",
        ...(!clippingPlanEnabled && {
          "&:hover": { elevation: 6, transform: "translateY(-2px)" },
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          "& .MuiSvgIcon-root": {
            color: clippingPlanEnabled ? "primary.main" : "text.secondary",
          },
        }}
      >
        <Tooltip title="Plan de coupe (vue 3D)">
          <ToggleButtonGroup
            value={clippingPlanEnabled ? "CLIP" : null}
            exclusive
            onChange={handleToggle}
          >
            <ToggleButton value="CLIP" size="small">
              <IconCutPlaneSide />
            </ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
      </Box>
    </Paper>
  );
}
