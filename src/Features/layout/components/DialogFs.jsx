import {Box, Dialog} from "@mui/material";

import HeaderTitleClose from "./HeaderTitleClose";
import BoxFlexV from "./BoxFlexV";

export default function DialogFs({
  title,
  open,
  onClose,
  children,
  fullScreen = true,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen}>
      <BoxFlexV sx={{pb: 2, bgcolor: "background.default"}}>
        <HeaderTitleClose title={title} onClose={onClose} />
        <Box
          sx={{
            width: 1,
            flexGrow: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </Box>
      </BoxFlexV>
    </Dialog>
  );
}
