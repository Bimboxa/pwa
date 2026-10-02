import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsImageMode } from "Features/viewers/viewersSlice";

import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { BASE_MAPS_IMAGE_MODE_OPTIONS } from "../constants/baseMapsImageMode";

// ---------------------------------------------------------------------------
// SectionBaseMapsImageMode — "Affichage global des fonds de plan" card of the
// Fonds de plan module panel: hidden / light grey / as is. One per-scope
// state (viewers.baseMapsImageMode) followed by the 2D map editors, the base
// maps grid and the 3D scene, over each base map's own eye and opacity.
// ---------------------------------------------------------------------------

export default function SectionBaseMapsImageMode() {
  // strings

  const titleS = "Affichage global des fonds de plan";
  const captionS =
    "S'applique à tous les fonds de plan, en 2D, en 3D et dans la grille de plans.";

  // data

  const dispatch = useDispatch();
  const imageMode = useSelector((s) => s.viewers.baseMapsImageMode);

  // handlers

  function handleChange(_event, mode) {
    // exclusive group: a click on the selected button gives null
    if (!mode) return;
    dispatch(setBaseMapsImageMode(mode));
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {titleS}
      </Typography>

      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={imageMode}
        onChange={handleChange}
      >
        {BASE_MAPS_IMAGE_MODE_OPTIONS.map(({ key, label, Icon }) => (
          <ToggleButton
            key={key}
            value={key}
            sx={{ gap: 0.5, textTransform: "none", lineHeight: 1.2 }}
          >
            <Icon fontSize="small" />
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        {captionS}
      </Typography>
    </WhiteSectionGeneric>
  );
}
