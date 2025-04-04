import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Dialog, DialogTitle, Box} from "@mui/material";
import HeaderTitleClose from "./HeaderTitleClose";
import BoxFlexVStretch from "./BoxFlexVStretch";

export default function DialogGeneric({title, open, onClose, children}) {
  // data

  const isMobile = useIsMobile();

  return open ? (
    <Dialog fullScreen={isMobile} open={open} onClose={onClose}>
      {Boolean(title) && !isMobile && <DialogTitle>{title}</DialogTitle>}
      {Boolean(title) && isMobile && (
        <HeaderTitleClose title={title} onClose={onClose} />
      )}

      <BoxFlexVStretch sx={{pb: isMobile ? 2 : 0}}>{children}</BoxFlexVStretch>
    </Dialog>
  ) : (
    <Box />
  );
}
