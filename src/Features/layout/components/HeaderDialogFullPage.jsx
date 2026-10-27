import { Box, Button, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

// Header of a full-page dialog (Configuration, Raccourcis…): title on the
// left, « Quitter » on the right with the letter closing the dialog (see
// useDialogQuitHotkey). `children` sit between the two (optional actions).
export default function HeaderDialogFullPage({
  title,
  onClose,
  hotkey = "Q",
  children,
}) {
  // strings

  const quitS = "Quitter";

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        px: 2,
        py: 1,
        bgcolor: "background.default",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="h6" noWrap>
        {title}
      </Typography>
      {children}
      <Button
        onClick={onClose}
        variant="outlined"
        startIcon={<Close />}
        size="small"
        sx={{ flexShrink: 0 }}
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
  );
}
