import { Box, Divider } from "@mui/material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";

export default function TopBarProjectAndScope() {
  return (
    <BoxFlexH sx={{ bgcolor: "white", borderRadius: 1, p: 0.5 }}>
      <ButtonSelectorProject />
      <Box sx={{ px: 1 }}>
        <Divider orientation="vertical" flexItem sx={{ height: 24 }} />
      </Box>
      <ButtonSelectorScope />
    </BoxFlexH>
  );
}
