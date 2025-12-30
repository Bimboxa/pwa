import { useDispatch, useSelector } from "react-redux";

import { setSelectedPresetScopeKey, setStepKey } from "../scopeCreatorSlice";

import usePresetScopes from "../hooks/usePresetScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import StepHeader from "./StepHeader";
import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function SectionSelectPresetScope() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  console.log("appConfig", appConfig.presetScopesObject)

  const presetScopes = usePresetScopes();
  const selectedPresetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  // helpers
  const backS = appConfig?.strings?.project?.select ?? "Choisir un projet";
  const addS = appConfig?.strings?.scope?.create ?? "Créer un dossier";
  const title =
    appConfig?.strings?.scopeConfig?.select ??
    "Sélectionnez un type de dossier";
  // helpers

  const items = presetScopes.map((ps) => ({
    ...ps,
    label: ps.name,
    id: ps.key,
  }));

  const selection = selectedPresetScopeKey ? [selectedPresetScopeKey] : [];

  // handlers

  function handleBackClick() {
    dispatch(setStepKey("SEARCH_PROJECT"));
  }

  function handlePresetClick(preset) {
    dispatch(
      setSelectedPresetScopeKey(
        preset.key === selectedPresetScopeKey ? null : preset.key
      )
    );
  }

  function handleAddClick() {
    dispatch(setStepKey("CREATE_SCOPE"));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <ButtonGeneric
          label={backS}
          onClick={handleBackClick}
          startIcon={<ArrowBackIos />}
        />
      </Box>

      <StepHeader title={title} />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          mb: 3,
        }}
      >
        <ListItemsGeneric
          items={items}
          onClick={handlePresetClick}
          selection={selection}
          keyString="key"
        />
      </Box>

      {selectedPresetScopeKey && (
        <ButtonInPanelV2
          label={addS}
          onClick={handleAddClick}
          variant="contained"
          color="secondary"
        />
      )}
    </BoxFlexVStretch>
  );
}
