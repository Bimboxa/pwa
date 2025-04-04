import {Box, Typography} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BlockEditableAppConfigItem from "./BlockEditableAppConfigItem";

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
      {appConfigItems.map((item) => {
        return <BlockEditableAppConfigItem key={item.key} item={item} />;
      })}
    </BoxFlexVStretch>
  );
}
