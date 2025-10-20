import { useSelector, useDispatch } from "react-redux";

import { setBaseMapOpacity } from "Features/mapEditor/mapEditorSlice";
import { setBaseMapGrayScale } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import FieldSlider from "Features/form/components/FieldSlider";

export default function SectionBaseMapInMapEditorFormat() {
  const dispatch = useDispatch();

  // strings

  const baseMapS = "Fond de plan";

  // data

  const opacity = useSelector((s) => s.mapEditor.baseMapOpacity);
  const grayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);

  // handlers

  function handleOpacityChange(value) {
    dispatch(setBaseMapOpacity(value));
  }

  function handleGrayScaleChange(value) {
    dispatch(setBaseMapGrayScale(value));
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography sx={{ p: 1, fontWeight: "bold" }} variant="body2">
        {baseMapS}
      </Typography>
      <FieldSlider
        label="Opacité"
        value={opacity}
        onChange={handleOpacityChange}
      />
      <FieldCheck
        label="N&B"
        value={grayScale}
        onChange={handleGrayScaleChange}
      />
    </Box>
  );
}
