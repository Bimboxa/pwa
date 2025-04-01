import {Box} from "@mui/material";

export default function PanelShowable({sx, children, show}) {
  // helpers

  const transform = show ? "translateX(0)" : "translateX(100%)";

  return <Box sx={{width: 1, height: 1, transform, ...sx}}>{children}</Box>;
}
