import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  CropLandscape as LandscapeIcon,
  CropPortrait as PortraitIcon,
} from "@mui/icons-material";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";

export default function CardPortfolioPageOrientation({ page }) {
  // data

  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();

  // handlers

  async function handleChange(_, value) {
    if (!value || !page || !portfolio) return;
    await updateEntity(page.id, { orientation: value }, { listing: portfolio });
  }

  // render

  if (!page) return null;

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        p: 2,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        Orientation
      </Typography>

      <ToggleButtonGroup
        value={page.orientation}
        exclusive
        onChange={handleChange}
        size="small"
        fullWidth
      >
        <ToggleButton value="landscape">
          <LandscapeIcon fontSize="small" sx={{ mr: 0.5 }} />
          <Typography variant="body2">Paysage</Typography>
        </ToggleButton>
        <ToggleButton value="portrait">
          <PortraitIcon fontSize="small" sx={{ mr: 0.5 }} />
          <Typography variant="body2">Portrait</Typography>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
