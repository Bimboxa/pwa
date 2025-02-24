import {Box} from "@mui/material";
import BoxAlignH from "./BoxAlignH";

import BlockProjectName from "Features/projects/components/BlockProjectName";

import IconButtonPopperSettings from "Features/settings/components/IconButtonPopperSettings";
import IconButtonReceivingConnection from "Features/webrtc/components/IconButtonReceivingConnection";

export default function TopBarMobile() {
  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <BoxAlignH gap={1}>
        <BlockProjectName />
        <IconButtonPopperSettings />
      </BoxAlignH>

      <IconButtonReceivingConnection />
    </Box>
  );
}
