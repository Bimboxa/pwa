import {Box, Typography, IconButton, Paper} from "@mui/material";
import {ArrowBackIos as Back} from "@mui/icons-material";
import {useMemo} from "react";
import {useTheme} from "@mui/material/styles";
import useIsMobile from "Features/layout/hooks/useIsMobile";

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

  const isMobile = useIsMobile();

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
        <Typography
          sx={{fontWeight: isMobile ? "normal" : "bold"}}
          variant={isMobile ? "body2" : "body1"}
        >
          {label}
        </Typography>
        <Box sx={{width: "24px"}} />
      </Paper>
    </Box>
  );
}
