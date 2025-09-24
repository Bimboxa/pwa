import { Box, Typography } from "@mui/material";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function FieldButton({ label, options }) {
  const buttonLabel = options?.buttonLabel;
  const buttonVariant = options?.buttonVariant;
  const buttonColor = options?.buttonColor;
  const buttonSize = options?.buttonSize;
  const onClick = options?.onClick;

  return (
    <Box sx={{ width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
        <ButtonInPanelV2
          label={buttonLabel}
          variant={buttonVariant}
          color={buttonColor}
          onClick={onClick}
          size={buttonSize}
        />
      </Box>
    </Box>
  );
}
