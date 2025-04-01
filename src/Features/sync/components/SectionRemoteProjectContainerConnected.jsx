import {Box} from "@mui/material";

import BlockRemoteProjectContainer from "./BlockRemoteProjectContainer";
import SectionRemoteProjectContainer from "./SectionRemoteProjectContainer";
import SectionDisconnectRemoteProjectContainer from "./SectionDisconnectRemoteProjectContainer";

export default function SectionRemoteProjectConainerConnected() {
  return (
    <Box>
      <BlockRemoteProjectContainer />
      <SectionDisconnectRemoteProjectContainer />
    </Box>
  );
}
