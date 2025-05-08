import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
//import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";
import BlockRemoteAppConfigFile from "./BlockRemoteAppConfigFile";
import SectionOrgaData from "Features/orgaData/components/SectionOrgaData";
import ButtonResetApp from "./ButtonResetApp";
import SectionUpdateAppConfigFromFile from "./SectionUpdateAppConfigFromFile";
import SectionAppConfigTitle from "./SectionAppConfigTitle";
import SectionRemoteContainerOverview from "Features/sync/components/SectionRemoteContainerOverview";
import SectionUpdateAppVersion from "./SectionUpdateAppVersion";
import ButtonDeleteProjects from "./ButtonDeleteProjects";

export default function PanelAppConfig({onClose}) {
  // data

  const remoteContainer = useRemoteContainer();

  return (
    <BoxFlexVStretch>
      <SectionUpdateAppVersion />
      <SectionAppConfigTitle />
      <SectionUpdateAppConfigFromFile />
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        {remoteContainer && <SectionRemoteContainerOverview />}
        {remoteContainer && <BlockRemoteAppConfigFile />}
        <SectionOrgaData />
        <ButtonDeleteProjects onDeleted={onClose} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
