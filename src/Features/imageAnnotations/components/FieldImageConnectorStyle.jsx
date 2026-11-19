import { useState } from "react";

import {
  Box,
  Popover,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CallMade as ArrowIcon,
  FiberManualRecord as PointIcon,
  Pin as NumberIcon,
} from "@mui/icons-material";

import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import { toggleGroupSx } from "Features/annotations/constants/fieldSx";

// Link line of a photo: colour swatch + end marker (numbered badge, arrow
// head or dot). Presentational: shared by the annotation panel and the
// annotation template form. `onChange` receives a partial
// `{ imageConnectorColor }` / `{ imageConnectorEnd }`.
export default function FieldImageConnectorStyle({
  color,
  end,
  onChange,
  endAction,
}) {
  // strings
  const labelS = "Connecteur";
  const numberS = "Numéro";
  const arrowS = "Flèche";
  const pointS = "Point";

  // state
  const [anchorEl, setAnchorEl] = useState(null);

  // handlers
  function handleColorChange(imageConnectorColor) {
    onChange({ imageConnectorColor });
  }

  function handleEndChange(_event, imageConnectorEnd) {
    if (imageConnectorEnd !== null) onChange({ imageConnectorEnd });
  }

  // render
  return (
    <WhiteSectionGeneric>
      <Box
        sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {labelS}
          </Typography>
          <Box
            onClick={(event) => setAnchorEl(event.currentTarget)}
            sx={{
              width: 24,
              height: 24,
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: color,
              cursor: "pointer",
              border: "2px solid",
              borderColor: "divider",
              "&:hover": { transform: "scale(1.1)" },
              transition: "transform 0.2s",
            }}
          />
        </Box>
        <ToggleButtonGroup
          value={end}
          exclusive
          onChange={handleEndChange}
          size="small"
          aria-label="Terminaison du connecteur"
          sx={toggleGroupSx}
        >
          <ToggleButton value="NUMBER" title={numberS} aria-label={numberS}>
            <NumberIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="ARROW" title={arrowS} aria-label={arrowS}>
            <ArrowIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="POINT" title={pointS} aria-label={pointS}>
            <PointIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        {endAction}
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } },
        }}
      >
        <ColorPickerContent
          color={color}
          onColorChange={handleColorChange}
          onClose={() => setAnchorEl(null)}
        />
      </Popover>
    </WhiteSectionGeneric>
  );
}
