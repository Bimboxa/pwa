import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import RocketLaunch from "@mui/icons-material/RocketLaunch";

import StepperStartingSections from "./StepperStartingSections";

// Header of the starting dialog, over the dashboard backdrop: the back arrow
// and the « Démarrer avec <appName> » rocket label at the exact spot of the
// dashboard button, the countdown band of the sections in the middle, the
// « Quitter » (Q) button on the right.
export default function HeaderStarting({
  title,
  sectionKey,
  onSelectSection,
  onClose,
  hotkey = "Q",
}) {
  // strings

  const backS = "Retour à l'accueil";
  const quitS = "Quitter";

  // render

  return (
    <Box
      sx={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 2,
        pl: 2,
        pr: 3,
        pt: 2,
        pb: 1,
        minHeight: 72,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
        <Tooltip title={backS}>
          <IconButton onClick={onClose} color="secondary" size="small">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            height: 40,
            color: "secondary.main",
          }}
        >
          <RocketLaunch fontSize="small" />
          <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
            {title}
          </Typography>
        </Box>
      </Box>

      <StepperStartingSections
        sectionKey={sectionKey}
        onSelect={onSelectSection}
      />

      <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{ flexShrink: 0, bgcolor: "white" }}
        >
          {quitS}
          <Typography
            variant="caption"
            sx={{
              ml: 1,
              fontSize: "0.6rem",
              lineHeight: 1,
              px: 0.5,
              py: 0.25,
              border: "1px solid currentColor",
              borderRadius: 0.5,
              opacity: 0.7,
              whiteSpace: "nowrap",
            }}
          >
            {hotkey}
          </Typography>
        </Button>
      </Box>
    </Box>
  );
}
