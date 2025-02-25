import {useState} from "react";
import {Box} from "@mui/material";

import SectionSettingsCurrent from "./SectionSettingsCurrent";
import SectionSettingsNew from "./SectionSettingsNew";

export default function SectionSettings() {
  const [openNew, setOpenNew] = useState(false);

  // handler

  function handleOpenNew() {
    setOpenNew(true);
  }
  function handleCancelNew() {
    setOpenNew(false);
  }
  function handleNewConfig() {
    setOpenNew(false);
  }
  return (
    <Box>
      {!openNew && <SectionSettingsCurrent onNewClick={handleOpenNew} />}
      {openNew && (
        <SectionSettingsNew
          onCancel={handleCancelNew}
          onNewConfig={handleNewConfig}
        />
      )}
    </Box>
  );
}
