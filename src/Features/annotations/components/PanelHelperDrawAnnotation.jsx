import { Box } from "@mui/material";

import Panel from "Features/layout/components/Panel";

import SectionShortcutHelpers from "./SectionShortcutHelpers";

export default function PanelHelperDrawAnnotation() {
  // render

  return <Panel>
    <Box sx={{ p: 1 }}>
      <SectionShortcutHelpers />
    </Box>
  </Panel>;
}
