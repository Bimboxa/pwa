import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import SectionRemoteProjectContainer from "./SectionRemoteProjectContainer";

export default function PanelSync() {
  return (
    <Box sx={{bgcolor: "background.default"}}>
      <SectionRemoteProjectContainer />
    </Box>
  );
}
