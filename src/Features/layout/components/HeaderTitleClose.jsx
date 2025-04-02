import {Box, IconButton, Typography} from "@mui/material";
import {Close} from "@mui/icons-material";

export default function HeaderTitleClose({title, onClose}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 1,
        bgcolor: "background.default",
      }}
    >
      <Box sx={{flexGrow: 1}}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <IconButton onClick={onClose}>
        <Close />
      </IconButton>
    </Box>
  );
}
