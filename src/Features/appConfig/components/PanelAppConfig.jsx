import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import { Box } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
//import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";
//import SectionOrgaData from "Features/orgaData/components/SectionOrgaData";
import SectionUpdateAppConfigFromFile from "./SectionUpdateAppConfigFromFile";
import SectionAppConfigTitle from "./SectionAppConfigTitle";
import SectionRemoteContainerOverview from "Features/sync/components/SectionRemoteContainerOverview";

import ButtonDeleteProjects from "./ButtonDeleteProjects";
import SwitchDisableRemoteContainer from "Features/sync/components/SwitchDisableRemoteContainer";

export default function PanelAppConfig({ onClose }) {
  // data

  const remoteContainer = useRemoteContainer();

  return (
    <BoxFlexVStretch>
      <SectionAppConfigTitle />
      <SectionUpdateAppConfigFromFile />
      <BoxFlexVStretch sx={{ overflow: "auto", flexGrow: 1 }}>
        {remoteContainer && <SectionRemoteContainerOverview />}
        {/* <SectionOrgaData /> */}
        <ButtonDeleteProjects onDeleted={onClose} />
      </BoxFlexVStretch>
      <Box sx={{ width: 1, display: "flex", justifyContent: "end" }}>
        <SwitchDisableRemoteContainer />
      </Box>
    </BoxFlexVStretch>
  );
}
