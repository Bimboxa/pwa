import {Box, IconButton, Typography} from "@mui/material";
import {ArrowBackIos as Back} from "@mui/icons-material";

export default function HeaderVariantBackTitle({title, onBackClick}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        //p: 1,
        bgcolor: "background.default",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <IconButton onClick={onBackClick}>
        <Back />
      </IconButton>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Box sx={{width: 24}} />
    </Box>
  );
}
