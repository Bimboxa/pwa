import {Box, Paper} from "@mui/material";

import BlockListingSelectedEntity from "./BlockListingSelectedEntity";
import SelectorMode from "./SelectorMode";

export default function HeaderRelsZoneEntity() {
  return (
    <Box sx={{p: 1, px: 2}}>
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          //p: 1,
        }}
      >
        <BlockListingSelectedEntity />
        {/* <SelectorMode /> */}
      </Paper>
    </Box>
  );
}
