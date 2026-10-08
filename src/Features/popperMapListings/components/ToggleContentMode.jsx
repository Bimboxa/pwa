import { useDispatch, useSelector } from "react-redux";

import { setViewerContentMode } from "../popperMapListingsSlice";

import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// ToggleContentMode — header toggle shared by the floating PopperMapListings
// and the docked PanelDrawing: "Annotations" | "Photos" (Viewer module with
// photos, `showPhotos`) | "Fonds de plan" (`showBaseMaps`, off in the popper
// while the base maps list is detached). The mode lives in redux
// (popperMapListings.viewerContentMode) so both surfaces agree.
// ---------------------------------------------------------------------------

export default function ToggleContentMode({
  showPhotos = false,
  showBaseMaps = true,
  showTools = false,
  annotationsLabel = "Annotations",
}) {
  const dispatch = useDispatch();

  // strings

  const photosS = "Photos";
  const baseMapsS = "Fonds de plan";
  const toolsS = "Commandes";

  // data

  const contentMode = useSelector((s) => s.popperMapListings.viewerContentMode);

  // helpers

  const options = [
    { value: "ANNOTATIONS", label: annotationsLabel },
    ...(showPhotos ? [{ value: "PHOTOS", label: photosS }] : []),
    ...(showBaseMaps ? [{ value: "BASE_MAPS", label: baseMapsS }] : []),
    ...(showTools ? [{ value: "TOOLS", label: toolsS }] : []),
  ];
  // "PHOTOS" stored from the Viewer module while this surface has no Photos
  // side: the body shows the annotations, so does the toggle.
  const value = options.some((o) => o.value === contentMode)
    ? contentMode
    : "ANNOTATIONS";

  // handlers

  function handleChange(_e, value) {
    if (value) dispatch(setViewerContentMode(value));
  }

  // render

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      // Inside the popper the header is the drag handle.
      onMouseDown={(e) => e.stopPropagation()}
      onChange={handleChange}
      sx={{ flex: 1, minWidth: 0 }}
    >
      {options.map(({ value, label }) => (
        <ToggleButton
          key={value}
          value={value}
          sx={{ flex: 1, py: 0.25, px: 0.5, minWidth: 0 }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            {label}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
