import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Box} from "@mui/material";
import HeaderTitleClose from "./HeaderTitleClose";
import BoxFlexVStretch from "./BoxFlexVStretch";

export default function ScreenGeneric({children, open, onClose, title, sx}) {
  // helpers

  const showHeader = title || onClose;
  const isMobile = useIsMobile();

  if (!open) return null;

  return (
    <Box
      sx={{
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        ...(isMobile && {pb: 2}),
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
