import {Box, IconButton, Typography} from "@mui/material";
import {Close} from "@mui/icons-material";

export default function HeaderTitleClose({title, subtitle, actions, onClose}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 1,
        bgcolor: "background.default",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{flexGrow: 1, minWidth: 0}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{display: "block"}}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
      {onClose && (
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      )}
    </Box>
  );
}
