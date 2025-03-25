import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

import {Box, Typography, IconButton, Paper} from "@mui/material";
import {ArrowBackIos as Back} from "@mui/icons-material";
import {useMemo} from "react";
import {useTheme} from "@mui/material/styles";

export default function BlockEntityInListPanelVariantHeader({
  label,
  onClose,
  bgcolor,
}) {
  const theme = useTheme();

  const textColor = useMemo(() => {
    const contrastText = theme.palette.getContrastText(bgcolor);
    return contrastText;
  }, [bgcolor, theme.palette]);

  return (
    <Box sx={{p: 1}}>
      <Paper
        sx={{
          bgcolor,
          color: textColor,
          display: "flex",
          alignItems: "center",
          p: 1,
          borderRadius: 2,
          justifyContent: "space-between",
        }}
      >
        <IconButton color="inherit" onClick={onClose}>
          <Back />
        </IconButton>
        <Typography sx={{fontWeight: "bold"}}>{label}</Typography>
        <Box sx={{width: "24px"}} />
      </Paper>
    </Box>
  );
}
