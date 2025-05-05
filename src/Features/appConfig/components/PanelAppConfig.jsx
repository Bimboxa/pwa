import {Box, Typography} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
//import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";
import BlockRemoteAppConfigFile from "./BlockRemoteAppConfigFile";
import SectionOrgaData from "Features/orgaData/components/SectionOrgaData";
import ButtonResetApp from "./ButtonResetApp";

export default function PanelAppConfig() {
  return (
    <BoxFlexVStretch>
      <BlockRemoteAppConfigFile />
      <BoxFlexVStretch>
        <SectionOrgaData />
      </BoxFlexVStretch>
      <ButtonResetApp />
    </BoxFlexVStretch>
  );
}
