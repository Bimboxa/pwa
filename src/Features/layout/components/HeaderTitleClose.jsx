import {Box, IconButton, Typography} from "@mui/material";
import {Close} from "@mui/icons-material";

export default function HeaderTitleClose({title, onClose}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{flexGrow: 1}}>
        <Typography>{title}</Typography>
      </Box>
      <IconButton onClick={onClose}>
        <Close />
      </IconButton>
    </Box>
  );
}
