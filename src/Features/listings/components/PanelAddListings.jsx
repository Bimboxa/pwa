import {useState} from "react";

import {Box} from "@mui/material";
import Panel from "Features/layout/components/Panel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import PanelAddListingsFromProject from "./PanelAddListingsFromProject";
import PanelAddListingsFromPresets from "./PanelAddListingsFromPresets";

export default function PanelAddListings() {
  // state

  const [mode, setMode] = useState("PROJECT");

  // helpers

  const options = [
    {key: "PROJECT", label: "Dossier"},
    {key: "PRESETS", label: "Pré-config"},
  ];

  // handlers

  function handleChangeMode(mode) {
    setMode(mode);
  }

  return (
    <Panel>
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        <Box sx={{p: 2}}>
          <ToggleSingleSelectorGeneric
            options={options}
            selectedKey={mode}
            onChange={handleChangeMode}
          />
        </Box>
        {mode === "PROJECT" && <PanelAddListingsFromProject />}
        {mode === "PRESETS" && <PanelAddListingsFromPresets />}
      </BoxFlexVStretch>
    </Panel>
  );
}
