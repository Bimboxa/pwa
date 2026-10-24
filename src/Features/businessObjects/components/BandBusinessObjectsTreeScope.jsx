import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountTreeOutlined,
  ChevronLeft,
  FormatListBulleted,
} from "@mui/icons-material";

import bandButtonSx from "Features/popperMapListings/utils/bandButtonSx";

// Level band of the business-objects tree (Krnet TreeList "scope bar"): the
// back button (one level up — hidden at the root), the current level (the
// listing name at the root, else the parent object's label over the path
// "listing / ancestors…") and the display mode toggle: children of the level
// only (drill-down buttons on the rows) | every descendant, indented.
export default function BandBusinessObjectsTreeScope({
  title,
  subtitle,
  onBack,
  mode,
  onModeChange,
}) {
  // strings

  const backS = "Niveau supérieur";
  const childrenS = "Enfants uniquement";
  const descendantsS = "Tous les descendants";

  // handlers

  function handleModeChange(_e, value) {
    if (value) onModeChange(value);
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: onBack ? 1 : 1.5,
        pr: 1,
        py: 0.75,
        bgcolor: "panel.sectionBg",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      {onBack && (
        <Tooltip title={backS} arrow placement="top">
          <Box component="button" onClick={onBack} sx={bandButtonSx}>
            <ChevronLeft sx={{ fontSize: 20 }} />
          </Box>
        </Tooltip>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ fontWeight: 700, textTransform: "uppercase", lineHeight: 1.2 }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="caption"
            noWrap
            sx={{ display: "block", color: "panel.textMuted", lineHeight: 1.2 }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={handleModeChange}
        sx={{ flexShrink: 0, bgcolor: "background.paper" }}
      >
        <ToggleButton
          value="CHILDREN"
          sx={{ px: 1, py: 0.25 }}
          title={childrenS}
        >
          <AccountTreeOutlined sx={{ fontSize: 18 }} />
        </ToggleButton>
        <ToggleButton
          value="DESCENDANTS"
          sx={{ px: 1, py: 0.25 }}
          title={descendantsS}
        >
          <FormatListBulleted sx={{ fontSize: 18 }} />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
