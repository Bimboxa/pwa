import { useState, useEffect } from "react";

import { useSelector } from "react-redux";

import useSelectedPresetScope from "../hooks/useSelectedPresetScope";
import useCreateScopeFromPreset from "../hooks/useCreateScopeFromPreset";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormScope from "Features/scopes/components/FormScope";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function SectionCreateScope() {
  // strings

  const createS = "Créer";

  // data

  const projectId = useSelector((s) => s.scopeCreator.selectedProjectId);
  const presetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  const presetScope = useSelectedPresetScope();

  const { createScopeFromPreset, isCreating } = useCreateScopeFromPreset({
    projectId,
  });

  // state

  const [tempScope, setTempScope] = useState({});

  // effect

  useEffect(() => {
    if (!tempScope?.name) {
      setTempScope({ ...tempScope, name: presetScope?.name });
    }
  }, [presetScope?.name]);

  // handlers

  async function handleCreateScope() {
    await createScopeFromPreset({ name: tempScope?.name, presetScopeKey });
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <FormScope scope={tempScope} onChange={setTempScope} />
      </Box>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateScope}
        variant="contained"
        disabled={isCreating || !tempScope?.name?.trim()}
      />
    </BoxFlexVStretch>
  );
}
