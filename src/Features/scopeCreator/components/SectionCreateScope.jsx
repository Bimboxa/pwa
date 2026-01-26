import { useState, useEffect, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setOpenScopeCreator, setStepKey } from "../scopeCreatorSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

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
import resolvePresetScopeEntities from "../services/resolvePresetScopeEntities";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";
import useCreateListing from "Features/listings/hooks/useCreateListing";

export default function SectionCreateScope() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const backS = "Retour";

  // data

  const projectId = useSelector((s) => s.scopeCreator.selectedProjectId);
  const presetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  const appConfig = useAppConfig();
  const presetScope = useSelectedPresetScope();
  const baseMapsListings = useProjectBaseMapListings({ projectId });
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();

  const createScope = useCreateScope();
  const createListing = useCreateListing();


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
    console.log("debug_25_09 [scope] created scope", scope, baseMapsListings);
    if (scope) {

      // baseMaps listing

      if (!baseMapsListings || baseMapsListings?.length === 0) {
        const baseMapsListing = await createListing({
          listing: { ...defaultBaseMapsListingProps, projectId },
          scope
        });
        console.log("debug_25_09 [baseMapsListing] created baseMapsListing", baseMapsListing);
        dispatch(setSelectedBaseMapsListingId(baseMapsListing?.id));
      }


      // selector 
      dispatch(setSelectedScopeId(scope.id));
      dispatch(setSelectedProjectId(projectId));
      dispatch(setSelectedListingId(newListings?.[0]?.id));
      dispatch(setOpenScopeCreator(false));
      navigate('/')
    }
  }

  function handleBackClick() {
    dispatch(setStepKey("SELECT_PRESET_SCOPE"));
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* <Box sx={{ p: 1 }}>
        <ButtonGeneric
          label={backS}
          onClick={handleBackClick}
          startIcon={<ArrowBackIos />}
        />
      </Box> */}
      {/* <StepHeader title={title} /> */}
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
