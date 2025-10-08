import { Box } from "@mui/material";

import ButtonSaveKrtoFile from "./ButtonSaveKrtoFile";
import ButtonLoadKrtoFile from "./ButtonLoadKrtoFile";

export default function ButtonsKrto() {
  return (
    <Box display="flex" gap={1}>
      <ButtonSaveKrtoFile />
      <ButtonLoadKrtoFile />
    </Box>
  );
}
