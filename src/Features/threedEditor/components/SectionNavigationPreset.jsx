import { useSelector, useDispatch } from "react-redux";

import { setNavigationPreset } from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Card,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";

import { NAVIGATION_PRESET_OPTIONS } from "Features/threedEditor/constants/navigationPresets";

// Mouse navigation preset card — device-local preference (persisted by the
// setNavigationPreset reducer). Shown in the Configuration dialog
// (PageEditor3d).
export default function SectionNavigationPreset() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Navigation";
  const helperS = "Boutons de la souris pour naviguer dans la vue 3D.";

  // data

  const navigationPreset = useSelector((s) => s.threedEditor.navigationPreset);

  // handlers

  function handleChange(event) {
    dispatch(setNavigationPreset(event.target.value));
  }

  // render

  return (
    <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {titleS}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {helperS}
      </Typography>
      <RadioGroup value={navigationPreset} onChange={handleChange}>
        {NAVIGATION_PRESET_OPTIONS.map(({ key, label, description }) => (
          <FormControlLabel
            key={key}
            value={key}
            control={<Radio size="small" />}
            sx={{ alignItems: "flex-start", mx: 0, mb: 0.5 }}
            label={
              <Box sx={{ pt: 0.75 }}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {description}
                </Typography>
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </Card>
  );
}
