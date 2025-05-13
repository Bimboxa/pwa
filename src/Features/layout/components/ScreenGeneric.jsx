import {Box} from "@mui/material";
import HeaderTitleClose from "./HeaderTitleClose";
import BoxFlexVStretch from "./BoxFlexVStretch";

export default function ScreenGeneric({children, open, onClose, title, sx}) {
  // helpers

  const showHeader = title || onClose;

  if (!open) return null;

  return (
    <Box
      sx={{
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        ...sx,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <BoxFlexVStretch>
        {showHeader && <HeaderTitleClose title={title} onClose={onClose} />}
        {children}
      </BoxFlexVStretch>
    </Box>
  );
}
