import { forwardRef } from "react";

import useIsMobile from "Features/layout/hooks/useIsMobile";

import { Dialog, DialogTitle, Box } from "@mui/material";
import HeaderTitleClose from "./HeaderTitleClose";
import BoxFlexVStretch from "./BoxFlexVStretch";

const DialogGeneric = forwardRef(function DialogGeneric(
  { title, open, onClose, children, vh, vw, width, height },
  ref
) {
  // data

  const isMobile = useIsMobile();

  return open ? (
    <Dialog
      fullScreen={isMobile}
      maxWidth={vw || width ? false : true}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          ref,
        },
      }}
    >
      {Boolean(title) && !isMobile && <DialogTitle>{title}</DialogTitle>}
      {Boolean(onClose || title) && isMobile && (
        <HeaderTitleClose title={title} onClose={onClose} />
      )}

      <BoxFlexVStretch
        sx={{
          pb: isMobile ? 2 : 0,
          ...(vh && !isMobile && { height: `${vh}vh` }),
          ...(vw && !isMobile && { width: `${vw}vw` }),
          ...(width && !isMobile && { width }),
          ...(height && !isMobile && { height }),
        }}
      >
        {children}
      </BoxFlexVStretch>
    </Dialog>
  ) : (
    <Box />
  );
});

export default DialogGeneric;
