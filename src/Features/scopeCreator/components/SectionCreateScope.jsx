import { useState, useEffect, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setOpenScopeCreator, setStepKey } from "../scopeCreatorSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

import useCreateScope from "Features/scopes/hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedPresetScope from "../hooks/useSelectedPresetScope";
import useCreatePortfolio from "Features/portfolios/hooks/useCreatePortfolio";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";

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
import useCreateListings from "Features/listings/hooks/useCreateListings";

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
  const createListings = useCreateListings();
  const createPortfolio = useCreatePortfolio();
  const createPortfolioPage = useCreatePortfolioPage();


  // state

  const [tempScope, setTempScope] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  // effect

  useEffect(() => {
    if (!tempScope?.name) {
      setTempScope({ ...tempScope, name: presetScope?.name });
    }
  }, [presetScope?.name]);

  // helpers

  const title = appConfig?.strings?.scope.create ?? "Créez un dossier";
  const createS = "Créer";


  // handlers

  async function handleCreateScope() {
    if (isCreating) return;
    setIsCreating(true);

    const newListings = await resolvePresetScopeListings({ presetScopeKey, appConfig, projectId });
    const newEntities = resolvePresetScopeEntities({ listings: newListings });

    console.log("debug_3001 [newListings, newEntities]", newListings, newEntities);

    const scope = await createScope({
      ...tempScope,
      projectId,
      newListings,
      newEntities,
      presetScopeKey,
    });
    console.log("debug_25_09 [scope] created scope", scope, baseMapsListings);
    if (scope) {

      // baseMaps listing

      if (!baseMapsListings || baseMapsListings?.length === 0) {
        const [baseMapsListing] = await createListings({
          listings: [{ ...defaultBaseMapsListingProps, projectId, canCreateItem: true }],
          scope,
        });
        console.log("debug_25_09 [baseMapsListing] created baseMapsListing", baseMapsListing);
        dispatch(setSelectedBaseMapsListingId(baseMapsListing?.id));
      }


      // auto-create portfolio with first page
      const portfolio = await createPortfolio({
        scopeId: scope.id,
        projectId,
        title: tempScope?.name || scope.name || "Portfolio",
      });
      await createPortfolioPage({
        listing: portfolio,
        projectId,
        title: "Page 1",
      });
      dispatch(setDisplayedPortfolioId(portfolio.id));

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
        disabled={isCreating}
      />
    </BoxFlexVStretch>
  );
}
