import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Dialog, DialogTitle, Box} from "@mui/material";

export default function DialogGeneric({title, open, onClose, children}) {
  // data

  const isMobile = useIsMobile();

  return open ? (
    <Dialog fullScreen={isMobile} open={open} onClose={onClose}>
      {Boolean(title) && <DialogTitle>{title}</DialogTitle>}
      {children}
    </Dialog>
  ) : (
    <Box />
  );
}
