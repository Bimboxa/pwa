import { useDispatch, useSelector } from "react-redux";

import {
  setBaseMapOpacityByIdIn3d,
  toggleBaseMapVisibleIn3d,
  toggleMainBaseMapImageIn3d,
} from "Features/threedEditor/threedEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import FieldSlider from "Features/form/components/FieldSlider";

// 3D counterpart of FieldBaseMapOpacity (same layout): drives the
// session-only 3D display state of THIS baseMap only, instead of
// `baseMap.opacity` (DB, 2D display).
// - Slider: per-baseMap override `opacityByBaseMapIdIn3d[baseMap.id]`
//   (falls back to the global `baseMapOpacityIn3d` when unset).
// - Eye: this baseMap's image visibility in the 3D scene — same toggles as
//   the top chips overlay and the "Fonds de plan" list of the 3D panel.
export default function FieldBaseMapOpacityIn3d({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const mainBaseMap = useMainBaseMap();
  const globalOpacity = useSelector(
    (s) => s.threedEditor.baseMapOpacityIn3d ?? 1
  );
  const opacityOverride = useSelector(
    (s) => s.threedEditor.opacityByBaseMapIdIn3d?.[baseMap?.id]
  );
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);

  // helpers

  const isMain = Boolean(baseMap?.id) && baseMap?.id === mainBaseMap?.id;
  const isVisible = isMain ? !hideMainImage : visibleIds.includes(baseMap?.id);
  const opacity = opacityOverride ?? globalOpacity;

  // handlers

  function handleOpacityChange(value) {
    if (!baseMap?.id) return;
    dispatch(
      setBaseMapOpacityByIdIn3d({ baseMapId: baseMap.id, opacity: value })
    );
  }

  function toggleVisibility() {
    if (!baseMap?.id) return;
    if (isMain) {
      dispatch(toggleMainBaseMapImageIn3d());
    } else {
      dispatch(toggleBaseMapVisibleIn3d(baseMap.id));
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: 1,
        p: 1,
        gap: 1,
      }}
    >
      <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
        <FieldSlider
          label="Opacité"
          value={opacity}
          onChange={handleOpacityChange}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center" }}>
        <IconButton onClick={toggleVisibility} size="small">
          {isVisible ? (
            <Visibility fontSize="small" />
          ) : (
            <VisibilityOff fontSize="small" color="error" />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}
