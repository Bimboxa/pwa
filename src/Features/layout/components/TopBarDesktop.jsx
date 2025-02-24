import {Box} from "@mui/material";
import BoxAlignH from "./BoxAlignH";

import BlockProjectName from "Features/projects/components/BlockProjectName";

import IconButtonInitiateConnection from "Features/webrtc/components/IconButtonInitiateConnection";
import IconButtonPopperSettings from "Features/settings/components/IconButtonPopperSettings";
import SelectorViewer from "Features/viewers/components/SelectorViewer";

export default function TopBarDesktop() {
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

      <SelectorViewer />

      <IconButtonInitiateConnection />
    </Box>
  );
}
