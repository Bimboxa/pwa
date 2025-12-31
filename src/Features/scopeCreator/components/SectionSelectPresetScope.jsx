import { useDispatch, useSelector } from "react-redux";

import { setSelectedPresetScopeKey, setStepKey } from "../scopeCreatorSlice";

import usePresetScopes from "../hooks/usePresetScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography, ListItemButton } from "@mui/material";
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
  const projectId = useSelector((s) => s.projects.selectedProjectId);


  const presetScopes = usePresetScopes();
  const selectedPresetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  // helers - show

  const showBack = !Boolean(projectId); // context = dashboard.

  // helpers

  //const backS = appConfig?.strings?.project?.select ?? "Choisir un projet";
  const backS = "Retour";
  const addS = appConfig?.strings?.scope?.create ?? "Créer un dossier";
  const title =
    appConfig?.strings?.scope?.selectPresetScope ??
    "Sélectionnez un type de dossier";

  // helpers

  const items = presetScopes?.map((ps) => ({
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
    dispatch(setStepKey("CREATE_SCOPE"));
  }

  function handleAddClick() {
    dispatch(setStepKey("CREATE_SCOPE"));
  }

  function handleNoPresetClick() {
    dispatch(setSelectedPresetScopeKey(null));
    dispatch(setStepKey("CREATE_SCOPE"));
  }

  return (
    <BoxFlexVStretch>
      {/* {showBack && <Box sx={{ p: 1 }}>
        <ButtonGeneric
          label={backS}
          onClick={handleBackClick}
          startIcon={<ArrowBackIos />}
        />
      </Box>} */}


      {/* <Typography
        variant="body2" color="text.secondary"
        sx={{ p: 1, fontStyle: "italic" }}>
        {title}
      </Typography> */}
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
          //selection={selection}
          keyString="key"
        />
        <ListItemButton onClick={handleNoPresetClick} divider >
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>Aucun modèle</Typography>
        </ListItemButton>
      </Box>

      {/* {selectedPresetScopeKey && (
        <ButtonInPanelV2
          label={addS}
          onClick={handleAddClick}
          variant="contained"
          color="secondary"
        />
      )} */}
    </BoxFlexVStretch>
  );
}
