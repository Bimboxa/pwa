import {Box, Typography} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
//import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";
import BlockRemoteAppConfigFile from "./BlockRemoteAppConfigFile";

export default function PanelAppConfig() {
  // strings

  const title = "Configuration de l'application";

  // data

  const appConfigItems = [
    {
      key: "strings",
      label: "Fichier global (.yml)",
      value: {},
    },
  ];
  return (
    <BoxFlexVStretch>
      <BlockRemoteAppConfigFile />
    </BoxFlexVStretch>
  );
}
