import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

import db from "App/db/db";

const FORMATS = ["A4", "A3"];

export default function CardPortfolioPageSize({ page }) {
  // handlers

  async function handleChange(_, value) {
    if (!value || !page) return;
    await db.portfolioPages.update(page.id, { format: value });
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
        Format
      </Typography>

      <ToggleButtonGroup
        value={page.format}
        exclusive
        onChange={handleChange}
        size="small"
        fullWidth
      >
        {FORMATS.map((f) => (
          <ToggleButton key={f} value={f}>
            <Typography variant="body2">{f}</Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
