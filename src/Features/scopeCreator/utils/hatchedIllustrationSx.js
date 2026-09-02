import { alpha } from "@mui/material/styles";

// warm hatched placeholder shown when a configuration has no SVG illustration
const hatchedIllustrationSx = {
  background: (theme) =>
    `repeating-linear-gradient(45deg, ${alpha(
      theme.palette.secondary.main,
      0.05
    )} 0px, ${alpha(
      theme.palette.secondary.main,
      0.05
    )} 10px, transparent 10px, transparent 20px), #FBF7F3`,
};

export default hatchedIllustrationSx;
