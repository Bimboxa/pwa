import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, IconButton, Slider, Tooltip, Typography } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import db from "App/db/db";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// "Opacité" of an annotation (IMAGE): slider written on mouse-up only (the
// map is not re-rendered while sliding) + eye toggle that jumps straight to
// 0 and back to the previous value (opacityBeforeHide on the row).
export default function FieldAnnotationOpacity({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Opacité";
  const hideS = "Masquer (opacité 0)";
  const showS = "Afficher";

  // data

  const opacity = Number.isFinite(annotation?.opacity) ? annotation.opacity : 1;
  const isHidden = opacity <= 0;

  // state — local value while sliding, resynced from the row on commit

  const [localOpacity, setLocalOpacity] = useState(opacity);
  useEffect(() => {
    setLocalOpacity(opacity);
  }, [opacity, annotation?.id]);

  // handlers

  async function commit(changes) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, changes);
    dispatch(triggerAnnotationsUpdate());
  }

  function handleSliderChange(_e, value) {
    setLocalOpacity(value);
  }

  async function handleSliderCommit(_e, value) {
    const next = Math.min(1, Math.max(0, value));
    if (next === opacity) return;
    await commit({ opacity: next });
  }

  async function handleEyeClick() {
    if (isHidden) {
      const restored = annotation?.opacityBeforeHide;
      await commit({
        opacity: Number.isFinite(restored) && restored > 0 ? restored : 1,
      });
    } else {
      await commit({ opacity: 0, opacityBeforeHide: opacity });
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {labelS}
        </Typography>
        <Slider
          size="small"
          sx={{ flex: 1, minWidth: 0, mx: 1 }}
          value={localOpacity}
          min={0}
          max={1}
          step={0.01}
          valueLabelDisplay="auto"
          valueLabelFormat={(x) => `${Math.round(x * 100)}%`}
          onChange={handleSliderChange}
          onChangeCommitted={handleSliderCommit}
        />
        <Tooltip title={isHidden ? showS : hideS}>
          <IconButton size="small" onClick={handleEyeClick}>
            {isHidden ? (
              <VisibilityOff fontSize="small" />
            ) : (
              <Visibility fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </WhiteSectionGeneric>
  );
}
