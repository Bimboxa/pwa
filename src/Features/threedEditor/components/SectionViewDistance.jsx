import { useSelector, useDispatch } from "react-redux";

import { setMaxViewDistance } from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Card,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";

import {
  VIEW_DISTANCE_AUTO,
  VIEW_DISTANCE_OPTIONS,
} from "Features/threedEditor/constants/viewDistances";

// Max view distance card — device-local preference (persisted by the
// setMaxViewDistance reducer). Shown in the Configuration dialog
// (PageEditor3d).
export default function SectionViewDistance() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Distance de vue max";
  const helperS =
    "Recul maximal de la caméra dans la vue 3D. À augmenter pour les grandes scènes (scans, plans de masse).";

  // data

  const maxViewDistance = useSelector((s) => s.threedEditor.maxViewDistance);

  // handlers

  function handleChange(event) {
    const raw = event.target.value;
    dispatch(
      setMaxViewDistance(raw === VIEW_DISTANCE_AUTO ? raw : Number(raw))
    );
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
      <RadioGroup value={String(maxViewDistance)} onChange={handleChange}>
        {VIEW_DISTANCE_OPTIONS.map(({ key, label, description }) => (
          <FormControlLabel
            key={key}
            value={String(key)}
            control={<Radio size="small" />}
            sx={{ alignItems: "flex-start", mx: 0, mb: 0.5 }}
            label={
              <Box sx={{ pt: 0.75 }}>
                <Typography variant="body2">{label}</Typography>
                {description && (
                  <Typography variant="caption" color="text.secondary">
                    {description}
                  </Typography>
                )}
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </Card>
  );
}
