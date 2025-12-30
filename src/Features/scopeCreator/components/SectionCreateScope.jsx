import { useState, useEffect, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setOpenScopeCreator, setStepKey } from "../scopeCreatorSlice";

import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedPresetScope from "../hooks/useSelectedPresetScope";

import { Box } from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormScope from "Features/scopes/components/FormScope";
import StepHeader from "./StepHeader";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import resolvePresetScopeListings from "../services/resolvePresetScopeListings";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import resolvePresetScopeEntities from "../services/resolvePresetScopeEntities";

export default function SectionCreateScope() {
  const dispatch = useDispatch();

  // strings

  const backS = "Retour";

  // data

  const projectId = useSelector((s) => s.scopeCreator.selectedProjectId);
  const presetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  const appConfig = useAppConfig();
  const presetScope = useSelectedPresetScope();

  const createScope = useCreateScope();

  // state

  const [tempScope, setTempScope] = useState({});

  // effect

  useEffect(() => {
    if (!tempScope?.name) {
      setTempScope({ ...tempScope, name: presetScope?.name });
    }
  }, [presetScope?.name]);

  // helpers

  const title = appConfig?.strings?.scope.create ?? "Créez un dossier";
  const createS = "Créer";

  // helpers - listings

  const newListings = useMemo(() => {
    return resolvePresetScopeListings({ presetScopeKey, appConfig, projectId });
  }, [presetScopeKey, appConfig?.presetScopesObject, projectId]);

  // helpers - entities

  const newEntities = useMemo(() => {
    return resolvePresetScopeEntities({ listings: newListings });
  }, [newListings]);

  console.log("debug_3012_newListings", newListings, newEntities)

  // handlers

  async function handleCreateScope() {
    const scope = await createScope({
      ...tempScope,
      projectId,
      newListings,
      newEntities,
    });
    console.log("debug_25_09 [scope] created scope", scope);
    if (scope) {
      dispatch(setSelectedScopeId(scope.id));
      dispatch(setSelectedProjectId(projectId));
      dispatch(setSelectedListingId(newListings?.[0]?.id));
      dispatch(setOpenScopeCreator(false));
    }
  }

  function handleBackClick() {
    dispatch(setStepKey("SELECT_PRESET_SCOPE"));
  }

  // render

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
      <Box sx={{ p: 1 }}>
        <FormScope scope={tempScope} onChange={setTempScope} />
      </Box>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateScope}
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
