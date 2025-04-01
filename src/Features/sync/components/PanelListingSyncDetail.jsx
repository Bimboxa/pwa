import {Box} from "@mui/material";

import SectionRemoteListing from "./SectionRemoteListing";
import ButtonCreateRemoteListing from "./ButtonCreateRemoteListing";

export default function PanelListingSyncDetail() {
  return (
    <Box>
      <SectionRemoteListing />
      <ButtonCreateRemoteListing />
    </Box>
  );
}
