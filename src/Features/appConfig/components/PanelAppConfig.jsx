import {Box, Typography} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
//import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";
import BlockRemoteAppConfigFile from "./BlockRemoteAppConfigFile";
import SectionOrgaData from "Features/orgaData/components/SectionOrgaData";

export default function PanelAppConfig() {
  return (
    <BoxFlexVStretch>
      <BlockRemoteAppConfigFile />
      <SectionOrgaData />
    </BoxFlexVStretch>
  );
}
