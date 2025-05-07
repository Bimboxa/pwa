import {Box, Typography} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
//import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";
import BlockRemoteAppConfigFile from "./BlockRemoteAppConfigFile";
import SectionOrgaData from "Features/orgaData/components/SectionOrgaData";
import ButtonResetApp from "./ButtonResetApp";
import SectionUpdateAppConfigFromFile from "./SectionUpdateAppConfigFromFile";
import SectionAppConfigTitle from "./SectionAppConfigTitle";
import SectionRemoteContainerOverview from "Features/sync/components/SectionRemoteContainerOverview";

export default function PanelAppConfig() {
  return (
    <BoxFlexVStretch>
      <SectionAppConfigTitle />
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        <SectionRemoteContainerOverview />
        <BlockRemoteAppConfigFile />
        <BoxFlexVStretch sx={{minHeight: 0}}>
          <SectionOrgaData />
        </BoxFlexVStretch>

        <SectionUpdateAppConfigFromFile />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
