import { Box, Typography } from "@mui/material";

import TutorialMarkdown from "./TutorialMarkdown";

import useSelectedScopeTutorial from "../hooks/useSelectedScopeTutorial";

// Right-band "Tutoriel" tool: the step-by-step guide of the selected scope's
// Krto configuration (Markdown file resolved by resolveAppConfig).
export default function PanelTutorial() {
  // strings

  const titleS = "Tutoriel";
  const emptyS = "Aucun tutoriel pour la configuration de ce plan de repérage.";

  // data

  const { tutorial, configuration, orgaCode } = useSelectedScopeTutorial();

  // render

  return (
    <Box
      sx={{
        height: 1,
        width: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          px: 2,
          minHeight: 44,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {titleS}
        </Typography>
        {configuration?.name && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {configuration.name}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, py: 1.5 }}>
        {tutorial?.markdown ? (
          <TutorialMarkdown
            markdown={tutorial.markdown}
            orgaCode={orgaCode}
            basePath={tutorial.basePath}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyS}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
