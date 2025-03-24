import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";

import {Box} from "@mui/material";

export default function BlockEntityInListPanelVariantBottom({label, onClick}) {
  return (
    <Box sx={{width: 1, bgcolor: "common.white"}}>
      <ButtonBasicMobile label={label} onClick={onClick} />
    </Box>
  );
}
