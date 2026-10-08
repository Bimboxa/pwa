import { useDispatch, useSelector } from "react-redux";

import { setViewerReturnContext } from "Features/viewers/viewersSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import {
  setSelectedListingId,
  setScopeModuleShowAllListings,
} from "Features/listings/listingsSlice";
import useSwitchViewer from "Features/viewers/hooks/useSwitchViewer";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeModuleLabel from "Features/listingViewer/hooks/useScopeModuleLabel";

import { Box, Button, Divider } from "@mui/material";

import { TOP_BAR_Z_INDEX } from "../constants/editorFloatingPanelsHost";
import { ArrowBack } from "@mui/icons-material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";

import ButtonSaveScope from "Features/remoteScopeConfigurations/components/ButtonSaveScope";
import ButtonHistoryScope from "Features/remoteScopeConfigurations/components/ButtonHistoryScope";
import IconButtonShareScope from "Features/scopes/components/IconButtonShareScope";
//import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import AuthButtons from "Features/auth/components/AuthButtons";
import TopBarProjectAndScope from "./TopBarProjectAndScope";

import TopBarBreadcrumbs from "./TopBarBreadcrumbs";
import useSelectedEntityModel from "Features/listings/hooks/useSelectedEntityModel";
import ToolbarDrawingTools from "Features/mapEditor/components/ToolbarDrawingTools";
import BlockVersionInTopBar from "Features/versions/components/BlockVersionInTopBar";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import SectionMainBaseMapControls from "Features/baseMaps/components/SectionMainBaseMapControls";

export default function TopBarDesktop() {
  const dispatch = useDispatch();
  const switchViewer = useSwitchViewer();

  // data

  const height = useSelector((s) => s.layout.topBarHeight);
  const appConfig = useAppConfig();
  const { value: listing } = useSelectedListing();
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const isCalibrating = useSelector((s) => s.baseMapEditor.isCalibrating);

  // helper - em

  const em = listing?.entityModel;

  // helpers

  const scopesEnabled = appConfig?.features?.scopes?.enabled;
  const returnViewer = viewerReturnContext?.fromViewer;
  const scopeModuleLabel = useScopeModuleLabel();

  // The return button is the only thing that clears a SCOPE / PORTFOLIO
  // return context (handleReturnToViewer) — every fromViewer written by the
  // recap / portfolio openers must have a label here.
  const returnLabelByViewer = {
    PORTFOLIO: "Portfolio",
    SCOPE: scopeModuleLabel,
  };
  const returnLabel = returnLabelByViewer[returnViewer];

  const isPortfolioViewer = viewerKey === "PORTFOLIO";

  // handlers

  function handleReturnToDrawing() {
    switchViewer("MAP");
    dispatch(setViewerReturnContext(null));
  }

  function handleReturnToViewer() {
    if (returnViewer === "PORTFOLIO" && viewerReturnContext?.portfolioId) {
      dispatch(setDisplayedPortfolioId(viewerReturnContext.portfolioId));
    }
    // The listing viewer reads s.listings.selectedListingId (MainListingViewer,
    // SelectorListingForViewer), not the listingViewer slice. A plan opened
    // from a listing goes back to that listing; one opened from the
    // all-listings recap goes back to it.
    if (returnViewer === "SCOPE") {
      const listingId = viewerReturnContext?.listingId;
      if (listingId) dispatch(setSelectedListingId(listingId));
      dispatch(setScopeModuleShowAllListings(!listingId));
    }
    switchViewer(returnViewer);
    dispatch(setViewerReturnContext(null));
  }

  return (
    <Box
      sx={{
        width: 1,
        height,
        minHeight: height,
        display: "flex",
        alignItems: "center",
        bgcolor: "white",
        // Under the editors' floating panels (draggable over the top bar).
        zIndex: TOP_BAR_Z_INDEX,
        pr: 2,
        pl: 0.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Left section - breadcrumbs */}
      <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <TopBarBreadcrumbs />
          {scopesEnabled && <ButtonSelectorScope />}
          {returnLabel && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 3 }}>
              <Divider orientation="vertical" sx={{ height: 24 }} />
              <Button
                size="small"
                color="secondary"
                startIcon={<ArrowBack />}
                onClick={handleReturnToViewer}
              >
                {returnLabel}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Center section - main base map controls (selector, versions, Z,
          calibration buttons; module-driven visibility, see the component —
          in full screen the same section floats over the editor) or
          portfolio return */}
      <SectionMainBaseMapControls />
      {isPortfolioViewer && (
        <Button
          size="small"
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={handleReturnToDrawing}
          sx={{
            bgcolor: "warning.main",
            color: "warning.contrastText",
            "&:hover": { bgcolor: "warning.dark" },
          }}
        >
          Revenir au module Dessin
        </Button>
      )}
      {viewerKey === "BASE_MAPS" &&
        returnViewer === "MAP" &&
        !isCalibrating && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={handleReturnToDrawing}
            sx={{
              ml: 2,
              bgcolor: "warning.main",
              color: "warning.contrastText",
              "&:hover": { bgcolor: "warning.dark" },
            }}
          >
            Revenir au Dessin
          </Button>
        )}

      {/* Right section - actions */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          justifyContent: "flex-end",
          gap: 1,
        }}
      >
        {/* 2D/3D editor toggle moved to the bottom-right overlay of both
            editors (UILayerDesktop / MainThreedEditor). */}
        {/* Scope-level actions (save/sync, history, share): available in
            every module, whichever editor it displays. */}
        {!viewerMode && (
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1,
            }}
          >
            <ButtonSaveScope />
            <ButtonHistoryScope />
            <IconButtonShareScope />
          </Box>
        )}
      </Box>
    </Box>
  );
}
