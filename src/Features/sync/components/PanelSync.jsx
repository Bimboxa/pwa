import {Box} from "@mui/material";

//import SectionRemoteProjectContainer from "./SectionRemoteProjectContainer";
import SectionRemoteContainer from "./SectionRemoteContainer";
import ButtonUploadChanges from "./ButtonUploadChanges";

export default function PanelSync() {
  return (
    <Box>
      <ButtonUploadChanges />
      <SectionRemoteContainer />
    </Box>
  );
}
