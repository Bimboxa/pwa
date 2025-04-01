import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Dialog, DialogTitle, Box} from "@mui/material";
import HeaderTitleClose from "./HeaderTitleClose";

export default function DialogGeneric({title, open, onClose, children}) {
  // data

  const isMobile = useIsMobile();

  return open ? (
    <Dialog fullScreen={isMobile} open={open} onClose={onClose}>
      {Boolean(title) && !isMobile && <DialogTitle>{title}</DialogTitle>}
      {Boolean(title) && isMobile && (
        <HeaderTitleClose title={title} onClose={onClose} />
      )}

      {children}
    </Dialog>
  ) : (
    <Box />
  );
}
