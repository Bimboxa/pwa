import { useMediaQuery } from "@mui/material";
import theme from "Styles/theme";

import { Typography, Box } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import BlockStartButtons from "./BlockStartButtons";

export default function PageOnboarding() {
  // strings

  const titleS = `Des plans de repérage,
    sans stabylo,
    pour les pros.`;

  // data

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <PageGeneric
      sx={{ alignItems: "center", justifyContent: "center", display: "flex" }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography
          variant={isMobile ? "h4" : "h1"}
          align="center"
          sx={{ whiteSpace: "pre-line", fontWeight: 700, lineHeight: 1.5 }}
        >
          {titleS}
        </Typography>
        <Box sx={{ mt: 3 }}>
          <BlockStartButtons isMobile={isMobile} />
        </Box>
      </Box>
    </PageGeneric>
  );
}
