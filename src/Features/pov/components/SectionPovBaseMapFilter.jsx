import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setBaseMapOpacity } from "Features/mapEditor/mapEditorSlice";
import { setBaseMapOpacityByIdIn3d } from "Features/threedEditor/threedEditorSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldSlider from "Features/form/components/FieldSlider";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// "Fond de plan" section of the POV Filtres tab: opacity slider + eye driving
// the generic base map display opacity — 2D base map (mapEditor.baseMapOpacity)
// and 3D MAIN base map (per-id override, so extra 3D maps keep their own
// opacity). Session-only redux, never written on the baseMap record; the value
// is persisted per-POV via snapshotPovViewService / applyPovSceneStateService.
export default function SectionPovBaseMapFilter() {
  // strings

  const titleS = "Fond de plan";

  // data

  const dispatch = useDispatch();
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const opacity = useSelector((s) => s.mapEditor.baseMapOpacity ?? 1);

  // state

  // Eye restore target: last non-zero opacity (FieldBaseMapOpacity pattern).
  const [lastValue, setLastValue] = useState(opacity > 0 ? opacity : 1);

  useEffect(() => {
    if (opacity > 0) setLastValue(opacity);
  }, [opacity]);

  // The 3D override is keyed by baseMap id: keep it glued to the current main
  // base map when the selection changes while the generic value is not 1.
  useEffect(() => {
    if (mainBaseMapId && opacity !== 1) {
      dispatch(setBaseMapOpacityByIdIn3d({ baseMapId: mainBaseMapId, opacity }));
    }
  }, [mainBaseMapId]);

  // helpers

  const isVisible = opacity > 0;

  function applyOpacity(value) {
    dispatch(setBaseMapOpacity(value));
    if (mainBaseMapId)
      dispatch(setBaseMapOpacityByIdIn3d({ baseMapId: mainBaseMapId, opacity: value }));
  }

  // handlers

  function handleChange(newValue) {
    applyOpacity(newValue);
  }

  function handleToggleVisibility() {
    applyOpacity(isVisible ? 0 : lastValue);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography variant="overline" sx={LABEL_SX}>
          {titleS}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", width: 1, gap: 1 }}>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            <FieldSlider
              label="Opacité"
              value={opacity}
              onChange={handleChange}
            />
          </Box>
          <IconButton onClick={handleToggleVisibility} size="small">
            {isVisible ? (
              <Visibility fontSize="small" />
            ) : (
              <VisibilityOff fontSize="small" color="error" />
            )}
          </IconButton>
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
